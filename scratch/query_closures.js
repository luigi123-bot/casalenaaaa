const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://ehggcwosjsxlfbdpbsmo.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVoZ2djd29zanN4bGZiZHBic21vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTU0ODI0MywiZXhwIjoyMDg1MTI0MjQzfQ.kz4GQHV2tnX603WgigFSb3sx4R5hHy8f0bkIKOZhSb8'
);

async function main() {
    console.log("Querying unique cajero values...");
    const { data, error } = await supabase
        .from('cash_closures')
        .select('cajero');
    
    if (error) {
        console.error("Error:", error);
    } else {
        const names = data.map(d => d.cajero);
        const uniqueNames = [...new Set(names)];
        console.log("Unique names in database:");
        uniqueNames.forEach(name => {
            console.log(`- "${name}" (length: ${name?.length})`);
        });
    }
}

main();
