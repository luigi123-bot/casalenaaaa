import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
    console.log("Fetching sessions...");
    const { data, error } = await supabase.from('cashier_sessions').select('*');
    if (error) console.error("Error:", error);
    else console.log("Sessions found:", data.length);
    if (data && data.length > 0) {
        console.log("Last 3 sessions:", data.slice(-3));
    }
}
run();
