async function runTests() {
  const catRes = await fetch('http://localhost:3000/api/categories').then(r => r.json());
  const prodRes = await fetch('http://localhost:3000/api/products').then(r => r.json());
  const firstCatId = catRes[0]?.id || 1;
  const firstProdId = prodRes[0]?.id || 1;

  const urls = [
    'http://localhost:3000/',
    'http://localhost:3000/products.html',
    `http://localhost:3000/category.html?id=${firstCatId}`,
    `http://localhost:3000/product.html?id=${firstProdId}`,
    'http://localhost:3000/about.html',
    'http://localhost:3000/contact.html',
    'http://localhost:3000/admin/login.html',
    'http://localhost:3000/admin/index.html',
    'http://localhost:3000/css/style.css',
    'http://localhost:3000/js/app.js',
    'http://localhost:3000/admin/css/admin.css',
    'http://localhost:3000/admin/js/admin.js',
    'http://localhost:3000/api/categories',
    'http://localhost:3000/api/products',
    `http://localhost:3000/api/products/${firstProdId}`,
    'http://localhost:3000/api/settings'
  ];

  console.log('Testing Island Nutrition endpoints:\n');
  let passed = 0;
  for (const url of urls) {
    const res = await fetch(url);
    const ct = res.headers.get('content-type') || 'unknown';
    const ok = res.status === 200;
    if (ok) passed++;
    const pathName = url.replace('http://localhost:3000', '') || '/';
    console.log(`${ok ? '✅' : '❌'} [${res.status}] ${pathName.padEnd(25)} -> ${ct.split(';')[0]}`);
  }

  console.log(`\nResults: ${passed}/${urls.length} endpoints passed.`);

  // Test admin login & session
  console.log('\nTesting Admin Login & Inquiries API:');
  const loginRes = await fetch('http://localhost:3000/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  const cookie = loginRes.headers.get('set-cookie');
  const loginData = await loginRes.json();
  console.log('Admin login result:', loginData);

  // Test submitting a public inquiry
  const postInquiryRes = await fetch('http://localhost:3000/api/inquiries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Professional QA Tester',
      email: 'qa@islandnutrition.com',
      phone: '+90 555 123 4567',
      company: 'Island Athletics Club',
      message: 'Interested in wholesale showroom distribution inquiry.'
    })
  });
  const postInquiryData = await postInquiryRes.json();
  console.log('Public inquiry submit:', postInquiryData);

  // Test authenticated admin retrieval of inquiries
  if (cookie) {
    const getInquiriesRes = await fetch('http://localhost:3000/api/admin/inquiries', {
      headers: { cookie }
    });
    const inqList = await getInquiriesRes.json();
    console.log(`Admin retrieved ${inqList.length} inquiries.`);

    const testInq = inqList.find(i => i.email === 'qa@islandnutrition.com');
    if (testInq) {
      // Test status update
      const statusRes = await fetch(`http://localhost:3000/api/admin/inquiries/${testInq.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', cookie },
        body: JSON.stringify({ status: 'replied' })
      });
      console.log('Update inquiry status to replied:', await statusRes.json());

      // Test delete inquiry cleanup
      const delRes = await fetch(`http://localhost:3000/api/admin/inquiries/${testInq.id}`, {
        method: 'DELETE',
        headers: { cookie }
      });
      console.log('Delete test inquiry cleanup:', await delRes.json());
    }

    // Check admin stats
    const statsRes = await fetch('http://localhost:3000/api/admin/stats', {
      headers: { cookie }
    });
    const statsData = await statsRes.json();
    console.log('Admin stats summary:', {
      categories: statsData.categories,
      products: statsData.products,
      inquiries: statsData.inquiries,
      unreadInquiries: statsData.unreadInquiries
    });
  }
}

runTests();
