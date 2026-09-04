import puppeteer from 'puppeteer';

(async () => {
  console.log("Starting Puppeteer verification for Admin Login...");
  
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  try {
    await page.goto('http://localhost:5173/', { waitUntil: 'load' });
    await page.evaluate(() => localStorage.clear());
    
    // Navigate to Admin Login
    await page.goto('http://localhost:5173/admin/login', { waitUntil: 'load' });
    console.log("Navigated to /admin/login");
    
    // Check if the "Go to User Login" button is there
    const hasUserButton = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.some(b => b.textContent.includes('Go to User Login'));
    });
    
    if (hasUserButton) {
      console.log("TEST 1 PASS: 'Go to User Login' button exists.");
    } else {
      console.error("TEST 1 FAIL: Missing 'Go to User Login' button.");
    }
    
    // Click "Go to User Login" and verify route
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.textContent.includes('Go to User Login'));
      if (btn) btn.click();
    });
    
    await new Promise(r => setTimeout(r, 1000));
    let currentUrl = page.url();
    if (currentUrl.endsWith('/auth')) {
      console.log("TEST 2 PASS: Successfully navigated to /auth.");
    } else {
      console.error("TEST 2 FAIL: Did not navigate to /auth. Current URL: " + currentUrl);
    }
    
    // Go back to admin login and test admin login
    await page.goto('http://localhost:5173/admin/login', { waitUntil: 'load' });
    
    // Enter credentials
    await page.type('input[name="email"]', 'admin@chargespot.demo');
    await page.type('input[name="password"]', 'password');
    
    // Click Secure Admin Login
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.textContent.includes('Secure Admin Login'));
      if (btn) btn.click();
    });
    
    await new Promise(r => setTimeout(r, 2000)); // wait for simulated delay and redirect
    currentUrl = page.url();
    
    if (currentUrl.endsWith('/admin')) {
      console.log("TEST 3 PASS: Admin login successfully navigated to /admin.");
    } else {
      console.error("TEST 3 FAIL: Admin login failed. Current URL: " + currentUrl);
    }
    
  } catch (err) {
    console.error("Verification failed:", err);
  } finally {
    await browser.close();
  }
})();
