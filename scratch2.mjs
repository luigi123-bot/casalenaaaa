import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
    console.log("Fetching orders 480 and 481...");
    const { data, error } = await supabase.from('orders')
        .select('id, ticket_number, created_at, status, user_id')
        .in('ticket_number', [480, 481]);
    if (error) console.error("Error:", error);
    else console.log("Orders:", data);
}
run();
