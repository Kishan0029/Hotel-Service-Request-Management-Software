const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/staff?select=id&limit=1`;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('Testing with manual fetch to:', url);

async function testFetch() {
  const start = Date.now();
  try {
    const res = await fetch(url, {
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`
      }
    });
    const data = await res.json();
    const end = Date.now();
    console.log(`Manual fetch response speed: ${end - start}ms`);
    console.log('Status:', res.status);
    console.log('Returned:', data);
  } catch (err) {
    console.error('Fetch Error:', err.message);
  }
}

testFetch();
