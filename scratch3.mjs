import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
    console.log("Fetching last 5 orders...");
    const { data, error } = await supabase.from('orders')
        .select('id, ticket_number, created_at, status, user_id, order_type')
        .order('created_at', { ascending: false })
        .limit(5);
    if (error) console.error("Error:", error);
    else console.log("Orders:", data);
}
run();
