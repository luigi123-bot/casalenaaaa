
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://ehggcwosjsxlfbdpbsmo.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVoZ2djd29zanN4bGZiZHBic21vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1NDgyNDMsImV4cCI6MjA4NTEyNDI0M30.zKprc8HE-biNHwZzt6joXIAP2ZXHRcHWJkFGUmMKWIQ'
);

async function check() {
    const { data, error } = await supabase.from('orders').select('*').limit(1);
    if (error) { console.error(error); return; }
    if (data.length > 0) {
        console.log('Columns in orders table:', Object.keys(data[0]).join(', '));
        console.log('Sample order:', JSON.stringify(data[0], null, 2));
    } else {
        console.log('No orders found');
    }
}

check();
