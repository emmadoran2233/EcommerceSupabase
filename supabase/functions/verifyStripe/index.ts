import { serve } from "https://deno.land/std/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js"

// Read environment variables
const supabaseUrl = Deno.env.get("SUPABASE_URL")!
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!  // Use the service key to update/delete data
const supabase = createClient(supabaseUrl, supabaseServiceKey)

serve(async (req) => {
  try {
    const { orderId, success, userId } = await req.json()

    if (success === "true") {
      // Update order status
      await supabase.from("orders").update({ payment: true }).eq("id", orderId)

      // Clear the shopping cart
      await supabase.from("users").update({ cartData: {} }).eq("id", userId)

      return new Response(JSON.stringify({ success: true }), { status: 200 })
    } else {
      //  Payment failed → Delete order
      await supabase.from("orders").delete().eq("id", orderId)

      return new Response(JSON.stringify({ success: false }), { status: 200 })
    }
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500 }
    )
  }
})
