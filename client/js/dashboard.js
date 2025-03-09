async function submitVisit() {
    const place = document.getElementById("place").value;
    const customer = document.getElementById("customer").value;
    const mobile = document.getElementById("mobile").value;
    const comments = document.getElementById("comments").value;
  
    navigator.geolocation.getCurrentPosition(async (position) => {
      const location = { lat: position.coords.latitude, lng: position.coords.longitude };
  
      await fetch(`${API_URL}/visits`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ place, customer, mobile, comments, location })
      });
  
      alert("Visit submitted!");
    });
  }
  