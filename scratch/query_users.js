const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://ehggcwosjsxlfbdpbsmo.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVoZ2djd29zanN4bGZiZHBic21vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTU0ODI0MywiZXhwIjoyMDg1MTI0MjQzfQ.kz4GQHV2tnX603WgigFSb3sx4R5hHy8f0bkIKOZhSb8'
);

async function main() {
    console.log("Querying profiles...");
    const { data, error } = await supabase
        .from('profiles')
        .select('*');
    
    if (error) {
        console.error("Error:", error);
    } else {
        console.log("Profiles found:", data);
    }
}

main();
