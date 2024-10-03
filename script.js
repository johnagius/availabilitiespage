document.addEventListener('DOMContentLoaded', function() {
  var calendarEl = document.getElementById('calendar');
  var today = new Date();  // Get current date

  // Initialize FullCalendar
  var calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'timeGridWeek',
    firstDay: 1,
    height: 'auto',
    slotMinTime: '07:00:00',  // Start at 7am
    slotMaxTime: '21:00:00',  // End at 9pm
    allDaySlot: false,
    expandRows: true,
    nowIndicator: true,
    validRange: {
      start: today,  // Disable navigating to past dates
    },
    views: {
      timeGridWeek: { buttonText: 'week' },
      timeGridDay: { buttonText: 'day' },
      dayGridMonth: { buttonText: 'month' }
    },
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'timeGridWeek,timeGridDay,dayGridMonth'
    },
    events: function(fetchInfo, successCallback, failureCallback) {
      const startDate = new Date(fetchInfo.start).toISOString();
      const endDate = new Date(fetchInfo.end).toISOString();

      // Fetch events for the calendar view (for this week/month)
      fetch(`https://www.googleapis.com/calendar/v3/calendars/labrint@gmail.com/events?key=AIzaSyDXC-eUmzsBiTSR2uWl15Okwl46VrMkoQE&timeMin=${startDate}&timeMax=${endDate}&singleEvents=true&orderBy=startTime`)
        .then(response => response.json())
        .then(data => {
          var events = data.items.map(function(event) {
            return {
              title: "WORKING",  // Always show "WORKING"
              start: event.start.dateTime || event.start.date,
              end: event.end.dateTime || event.end.date,
              description: '',  // Hide event details
              status: event.status,
              transparency: event.transparency || 'opaque'  // Consider "free" as busy
            };
          });

          successCallback(events);  // Render calendar events
        })
        .catch(error => {
          console.error('Error fetching events:', error);
          failureCallback(error);
        });
    },
    eventColor: '#007bff',
    eventTextColor: 'white'
  });

  calendar.render();

  // Tab Switching Logic
  var tabs = document.querySelectorAll('.tab');
  var contents = document.querySelectorAll('.content-container');
  tabs.forEach(tab => {
    tab.addEventListener('click', function() {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      var target = tab.getAttribute('data-target');
      contents.forEach(content => {
        if (content.id === target) {
          content.classList.add('active');
        } else {
          content.classList.remove('active');
        }
      });
    });
  });

  // Generate Free Slots Logic
  generateFreeSlots();

  function generateFreeSlots() {
    const workingHoursStart = 7;
    const workingHoursEnd = 21;
    const buffer = 1;  // 1-hour buffer before and after events
    const minFreeSlot = 3;  // Minimum 3-hour free slots
    let freeSlots = [];

    // Get free slots in the next 30 days
    let currentDate = new Date();
    let futureEndDate = new Date();
    futureEndDate.setDate(currentDate.getDate() + 30);

    // Fetch events for the free slots calculation (next 30 days)
    fetch(`https://www.googleapis.com/calendar/v3/calendars/labrint@gmail.com/events?key=AIzaSyDXC-eUmzsBiTSR2uWl15Okwl46VrMkoQE&timeMin=${currentDate.toISOString()}&timeMax=${futureEndDate.toISOString()}&singleEvents=true&orderBy=startTime`)
      .then(response => response.json())
      .then(data => {
        var parsedEvents = data.items.map(function(event) {
          let startDate = new Date(event.start.dateTime || event.start.date);
          let endDate = new Date(event.end.dateTime || event.end.date);
          
          return {
            date: startDate.toDateString(),
            startTime: startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            endTime: endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          };
        });

        // Iterate through each day to find free slots
        while (currentDate <= futureEndDate) {
          let dayEvents = parsedEvents.filter(event => {
            let eventDate = new Date(event.date);
            return eventDate.toDateString() === currentDate.toDateString();
          });

          // Sort events by start time
          dayEvents.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

          // Calculate free time between events
          let lastEnd = new Date(currentDate);
          lastEnd.setHours(workingHoursStart, 0, 0, 0); // Start at 7am

          dayEvents.forEach(event => {
            let eventStart = new Date(currentDate.toDateString() + ' ' + event.startTime);
            let freeStart = new Date(lastEnd);
            let freeEnd = new Date(eventStart);

            // Add buffer before and after the event
            freeEnd.setHours(freeEnd.getHours() - buffer);
            lastEnd = new Date(currentDate.toDateString() + ' ' + event.endTime);
            lastEnd.setHours(lastEnd.getHours() + buffer);

            // If the free time is 3 hours or more, add to freeSlots
            let freeDuration = (freeEnd - freeStart) / (1000 * 60 * 60); // in hours
            if (freeDuration >= minFreeSlot) {
              freeSlots.push({
                date: freeStart.toDateString(),
                startTime: freeStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                endTime: freeEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              });
            }
          });

          // Check free time after the last event of the day until 9pm
          let dayEnd = new Date(currentDate);
          dayEnd.setHours(workingHoursEnd, 0, 0, 0); // End at 9pm
          let freeStart = new Date(lastEnd);
          let freeEnd = new Date(dayEnd);
          let freeDuration = (freeEnd - freeStart) / (1000 * 60 * 60); // in hours

          if (freeDuration >= minFreeSlot) {
            freeSlots.push({
              date: freeStart.toDateString(),
              startTime: freeStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              endTime: freeEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            });
          }

          // Move to the next day
          currentDate.setDate(currentDate.getDate() + 1);
        }

        // Populate free slots table
        const tableBody = document.querySelector('#free-slots-table tbody');
        tableBody.innerHTML = '';
        freeSlots.forEach(slot => {
          let row = `<tr>
                      <td>${slot.date}</td>
                      <td>${slot.startTime}</td>
                      <td>${slot.endTime}</td>
                    </tr>`;
          tableBody.innerHTML += row;
        });
      })
      .catch(error => {
        console.error('Error fetching events for free slots:', error);
      });
  }
});
