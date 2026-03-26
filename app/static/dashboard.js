async function refresh() {
  try {
    const response = await fetch('/api/metrics');
    const data = await response.json();

    document.getElementById('status').textContent = data.status || '-';
    document.getElementById('last_error').textContent = data.last_error || 'Sem erros.';
    document.getElementById('total_events').textContent = data.total_events ?? 0;
    document.getElementById('unique_users').textContent = data.unique_users ?? 0;
    document.getElementById('unique_companies').textContent = data.unique_companies ?? 0;

    const topCompanies = document.getElementById('top_companies');
    topCompanies.innerHTML = '';
    (data.top_companies || []).forEach((item) => {
      const li = document.createElement('li');
      li.textContent = `${item.company}: ${item.count}`;
      topCompanies.appendChild(li);
    });

    const recentEvents = document.getElementById('recent_events');
    recentEvents.innerHTML = '';
    (data.recent_events || []).forEach((event) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${event.timestamp}</td>
        <td>${event.user}</td>
        <td>${event.company}</td>
        <td>${event.captured_at}</td>
      `;
      recentEvents.appendChild(row);
    });
  } catch (error) {
    document.getElementById('status').textContent = 'erro ao carregar';
  }
}

refresh();
setInterval(refresh, 5000);
