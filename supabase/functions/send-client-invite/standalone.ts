// STANDALONE VERSION - Copy this entire file to Supabase Dashboard
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const EMAIL_SENDER = 'Catalift <hello@catalift.net>'

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
  password?: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { to, clientName, trainerName, inviteToken, appUrl, password }: InviteEmailRequest = await req.json()
    const clientPassword = password || 'client123'

    if (!to || !inviteToken || !appUrl) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const inviteLink = `${appUrl}/invite?token=${inviteToken}`

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0a; color: #ffffff; padding: 40px 20px; margin: 0;">
        <div style="max-width: 500px; margin: 0 auto; background-color: #111111; border-radius: 16px; overflow: hidden;">
          <div style="background: linear-gradient(135deg, #0ea5e9 0%, #f97316 100%); padding: 32px; text-align: center;">
            <h1 style="margin: 0; font-size: 28px; font-weight: bold; color: white;">CATALIFT</h1>
            <p style="margin: 8px 0 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">Ignite Your Rise</p>
          </div>
          
          <div style="padding: 32px;">
            <h2 style="margin: 0 0 16px 0; font-size: 22px; color: #ffffff;">
              Hey${clientName ? ` ${clientName}` : ''}! 👋
            </h2>
            
            <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 1.6; color: #a1a1aa;">
              <strong style="color: #0ea5e9;">${trainerName}</strong> has invited you to join Catalift to track your workouts, monitor your progress, and achieve your fitness goals together.
            </p>
            
            <div style="background-color: #1a1a1a; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
              <p style="margin: 0 0 12px 0; font-size: 14px; color: #a1a1aa; font-weight: 600;">Your Login Details:</p>
              <div style="background-color: #262626; border-radius: 8px; padding: 12px; margin-bottom: 16px;">
                <p style="margin: 0 0 8px 0; font-size: 13px; color: #a1a1aa;">Email:</p>
                <p style="margin: 0; font-size: 15px; color: #ffffff; font-weight: 500;">${to}</p>
              </div>
              <div style="background-color: #262626; border-radius: 8px; padding: 12px; margin-bottom: 16px;">
                <p style="margin: 0 0 8px 0; font-size: 13px; color: #a1a1aa;">Password:</p>
                <p style="margin: 0; font-size: 15px; color: #ffffff; font-weight: 500;">${clientPassword}</p>
              </div>
              <p style="margin: 0; font-size: 12px; color: #f97316;">⚠️ You can change your password in the app settings after logging in.</p>
            </div>
            
            <div style="background-color: #1a1a1a; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
              <p style="margin: 0 0 8px 0; font-size: 14px; color: #a1a1aa;">With Catalift you can:</p>
              <ul style="margin: 0; padding-left: 20px; color: #ffffff; font-size: 14px; line-height: 1.8;">
                <li>View your workout history</li>
                <li>Track personal bests & progress</li>
                <li>Earn achievement medals</li>
                <li>Stay connected with your trainer</li>
              </ul>
            </div>
            
            <a href="${inviteLink}" style="display: block; width: 100%; padding: 16px 24px; background: linear-gradient(135deg, #0ea5e9 0%, #f97316 100%); color: white; text-decoration: none; text-align: center; border-radius: 12px; font-weight: 600; font-size: 16px; box-sizing: border-box;">
              Accept Invitation & Get Started
            </a>
            
            <p style="margin: 24px 0 0 0; font-size: 12px; color: #71717a; text-align: center;">
              This invitation expires in 7 days. If you didn't expect this email, you can safely ignore it.
            </p>
          </div>
          
          <div style="padding: 20px 32px; border-top: 1px solid #262626; text-align: center;">
            <p style="margin: 0; font-size: 12px; color: #52525b;">
              © ${new Date().getFullYear()} Catalift. All rights reserved.
            </p>
          </div>
        </div>
      </body>
      </html>
    `

    // Send email via Resend API
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: EMAIL_SENDER,
        to: [to],
        subject: `${trainerName} has invited you to Catalift`,
        html: emailHtml,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Resend API error:', errorText)
      return new Response(
        JSON.stringify({ error: 'Failed to send email', details: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const result = await response.json()
    console.log('Email sent successfully:', result.id)

    return new Response(
      JSON.stringify({ success: true, messageId: result.id }),
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
