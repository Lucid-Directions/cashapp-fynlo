// Test if WAF is still blocking JWT tokens

async function testWAFFixed() {
  try {
    // 1. Sign in with Supabase
    const signInRes = await fetch('https://eweggzpvuqczrrrwszyy.supabase.co/auth/v1/token?grant_type=password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3ZWdnenB2dXFjenJycndzenl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA3ODIyMTcsImV4cCI6MjA2NjM1ODIxN30.CRjEJ4w9xsIWB_PAMV_RfZox6yVMSnVT1b4QrA9SC0s'
      },
      body: JSON.stringify({
        email: 'arnaud@luciddirections.co.uk',
        password: 'Thursday_1'
      })
    });
    
    const signInData = await signInRes.json();
    
    if (signInData.access_token) {
      console.log('✅ Supabase sign in successful');
      
      // 2. Test backend /auth/verify
      const verifyRes = await fetch('https://fynlopos-9eg2c.ondigitalocean.app/api/v1/auth/verify', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${signInData.access_token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
      
      console.log('Backend response status:', verifyRes.status);
      
      if (verifyRes.ok) {
        const data = await verifyRes.json();
        console.log('✅ SUCCESS\! WAF is no longer blocking JWT tokens\!');
        console.log('User data:', JSON.stringify(data.user, null, 2));
      } else {
        const errorText = await verifyRes.text();
        console.log('❌ Backend still returning error:', errorText);
      }
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

testWAFFixed();
