import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { EMAIL_SENDER, sendEmail } from '../_shared/email.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface InviteEmailRequest {
  to: string
  clientName: string
  trainerName: string
  inviteToken: string
  appUrl: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { to, clientName, trainerName, inviteToken, appUrl }: InviteEmailRequest = await req.json()

    if (!to || !inviteToken || !appUrl) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const inviteLink = `${appUrl}/invite?token=${inviteToken}`

    // Build email HTML template
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0a; color: #ffffff; padding: 40px 20px; margin: 0;">
        <div style="max-width: 500px; margin: 0 auto; background-color: #111111; border-radius: 16px; overflow: hidden;">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #0ea5e9 0%, #f97316 100%); padding: 32px; text-align: center;">
            <h1 style="margin: 0; font-size: 28px; font-weight: bold; color: white;">CATALIFT</h1>
            <p style="margin: 8px 0 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">Ignite Your Rise</p>
          </div>
          
          <!-- Content -->
          <div style="padding: 32px;">
            <h2 style="margin: 0 0 16px 0; font-size: 22px; color: #ffffff;">
              Hey${clientName ? ` ${clientName}` : ''}! 👋
            </h2>
            
            <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 1.6; color: #a1a1aa;">
              <strong style="color: #0ea5e9;">${trainerName}</strong> has invited you to join Catalift to track your workouts, monitor your progress, and achieve your fitness goals together.
            </p>
            
            <div style="background-color: #1a1a1a; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
              <p style="margin: 0 0 8px 0; font-size: 14px; color: #a1a1aa;">With Catalift you can:</p>
              <ul style="margin: 0; padding-left: 20px; color: #ffffff; font-size: 14px; line-height: 1.8;">
                <li>View your workout history</li>
                <li>Track personal bests & progress</li>
                <li>Earn achievement medals</li>
                <li>Stay connected with your trainer</li>
              </ul>
            </div>
            
            <!-- CTA Button -->
            <a href="${inviteLink}" style="display: block; width: 100%; padding: 16px 24px; background: linear-gradient(135deg, #0ea5e9 0%, #f97316 100%); color: white; text-decoration: none; text-align: center; border-radius: 12px; font-weight: 600; font-size: 16px; box-sizing: border-box;">
              Accept Invitation & Get Started
            </a>
            
            <p style="margin: 24px 0 0 0; font-size: 12px; color: #71717a; text-align: center;">
              This invitation expires in 7 days. If you didn't expect this email, you can safely ignore it.
            </p>
          </div>
          
          <!-- Footer -->
          <div style="padding: 20px 32px; border-top: 1px solid #262626; text-align: center;">
            <p style="margin: 0; font-size: 12px; color: #52525b;">
              © ${new Date().getFullYear()} Catalift. All rights reserved.
            </p>
          </div>
        </div>
      </body>
      </html>
    `

    // Send email using centralized email utility with correct sender
    const result = await sendEmail(RESEND_API_KEY || '', {
      to,
      subject: `${trainerName} has invited you to Catalift`,
      html: emailHtml,
    })

    if (!result.success) {
      console.error('Failed to send email:', result.error)
      return new Response(
        JSON.stringify({ error: 'Failed to send email', details: result.error }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Email sent successfully:', result.messageId)

    return new Response(
      JSON.stringify({ success: true, messageId: result.messageId }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error sending invite email:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
