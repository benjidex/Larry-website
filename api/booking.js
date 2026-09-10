// Ensure apiBase is just the origin: "https://www.larrylarstudios.com.ng"
// Or adjust the path string if apiBase already contains "/api"
const response = await fetch(`${apiBase}/api/bookings`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload)
});