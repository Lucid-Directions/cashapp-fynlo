import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface StaffInvitationRequest {
  email: string;
  role: string;
  restaurant_name: string;
  inviter_name: string;
  restaurant_id: string;
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, role, restaurant_name, inviter_name, restaurant_id }: StaffInvitationRequest = await req.json();

    console.log(`Sending staff invitation to ${email} for ${restaurant_name}`);

    // Create staff invitation record
    const { data: invitation, error: inviteError } = await supabase
      .from('staff_invitations')
      .insert({
        restaurant_id,
        email,
        role,
        invited_by: req.headers.get('user-id')
      })
      .select()
      .single();

    if (inviteError) {
      console.error('Error creating invitation:', inviteError);
      throw inviteError;
    }

    const invitationUrl = `${Deno.env.get('SITE_URL')}/auth?invite=${invitation.invitation_token}&email=${encodeURIComponent(email)}`;

    const emailResponse = await resend.emails.send({
      from: `${restaurant_name} <noreply@resend.dev>`,
      to: [email],
      subject: `You're invited to join ${restaurant_name} staff team`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333;">You're invited to join our team!</h1>
          
          <p>Hi there,</p>
          
          <p><strong>${inviter_name}</strong> has invited you to join the staff team at <strong>${restaurant_name}</strong> as a <strong>${role}</strong>.</p>
          
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0;">What's next?</h3>
            <ol>
              <li>Click the invitation link below</li>
              <li>Create your account or sign in</li>
              <li>Start accessing your restaurant dashboard</li>
            </ol>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${invitationUrl}" 
               style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Accept Invitation
            </a>
          </div>
          
          <p style="color: #666; font-size: 14px;">
            This invitation will expire in 7 days. If you have any questions, please contact ${inviter_name} directly.
          </p>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          
          <p style="color: #999; font-size: 12px;">
            If you didn't expect this invitation, you can safely ignore this email.
          </p>
        </div>
      `,
    });

    console.log("Staff invitation email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ 
      success: true, 
      invitation_id: invitation.id,
      message: "Staff invitation sent successfully" 
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error("Error in send-staff-invitation function:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);