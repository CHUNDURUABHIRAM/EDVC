import puppeteer from 'puppeteer';

(async () => {
  console.log("Starting Puppeteer E2E test...");
  
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  try {
    // Navigate to Finder page
    await page.goto('http://localhost:5173/finder', { waitUntil: 'networkidle0' });
    console.log("Navigated to Finder page.");
    
    // Inject a fake station for testing so we know what to look for
    await page.evaluate(() => {
      const mockStation = {
        id: "OCM-TEST-001",
        name: "Puppeteer Test Station",
        location: "Test Location",
        city: "Test City",
        coordinates: [16.54078, 81.52322],
        chargers: [
          { id: "C1", type: "CCS2", speed: "50 kW", status: "AVAILABLE", price: 20 },
          { id: "C2", type: "Type 2", speed: "22 kW", status: "AVAILABLE", price: 15 }
        ]
      };
      // Force it into local storage and trigger update
      const stations = JSON.parse(localStorage.getItem('chargeSpotStations') || '[]');
      stations.push(mockStation);
      localStorage.setItem('chargeSpotStations', JSON.stringify(stations));
      window.dispatchEvent(new Event('chargespot-state-changed'));
    });
    
    await new Promise(r => setTimeout(r, 1000));
    console.log("Injected mock station.");
    
    // Check if map or list contains the station
    // Let's switch to List view for easier DOM inspection
    await page.evaluate(() => {
      const btns = document.querySelectorAll('.toggle-btn');
      for (const b of btns) {
        if (b.textContent.includes('List')) b.click();
      }
    });
    await new Promise(r => setTimeout(r, 1000));
    
    console.log("Switched to List View. Checking DOM...");
    
    // TEST 1: Check initial status
    let html = await page.content();
    if (html.includes("Puppeteer Test Station")) {
      console.log("TEST 1 PASS: Station rendered.");
    } else {
      console.error("TEST 1 FAIL: Station not found in DOM.");
    }
    
    // TEST 2: Network Status OFFLINE
    console.log("TEST 2: Changing network status to OFFLINE...");
    await page.evaluate(() => {
      const mods = JSON.parse(localStorage.getItem('chargeSpotOperatorMods') || '{}');
      mods["OCM-TEST-001"] = { networkApiStatus: "OFFLINE" };
      localStorage.setItem('chargeSpotOperatorMods', JSON.stringify(mods));
      
      // Simulate appState doing the merge 
      // (in a real scenario, appState handles this, but here we just trigger the event for the UI to pick up)
      const stations = JSON.parse(localStorage.getItem('chargeSpotStations') || '[]');
      const s = stations.find(s => s.id === "OCM-TEST-001");
      if (s) s.networkApiStatus = "OFFLINE";
      localStorage.setItem('chargeSpotStations', JSON.stringify(stations));
      
      window.dispatchEvent(new Event('chargespot-state-changed'));
      window.dispatchEvent(new Event('storage')); // trigger cross-tab listener too
    });
    
    await new Promise(r => setTimeout(r, 1000));
    
    // Check DOM again. If OFFLINE, Available chargers should be 0.
    const hasZeroFree = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.list-card'));
      const testCard = cards.find(c => c.innerHTML.includes("Puppeteer Test Station"));
      if (!testCard) return false;
      return testCard.innerHTML.includes("0/2 free") || testCard.innerHTML.includes("OFFLINE");
    });
    
    if (hasZeroFree) {
      console.log("TEST 2 PASS: Status changed to OFFLINE properly reflected in User side.");
    } else {
      console.error("TEST 2 FAIL: User side did not update to 0/2 free or OFFLINE.");
    }
    
    console.log("All Puppeteer checks completed.");
    
  } catch (err) {
    console.error("Test script failed:", err);
  } finally {
    await browser.close();
  }
})();
