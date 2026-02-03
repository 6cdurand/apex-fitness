/**
 * Centralized email configuration for Catalift
 * All email sending must use these constants and utilities
 */

// Single source of truth for sender address
export const EMAIL_SENDER = 'Catalift <hello@send.catalift.net>';
export const EMAIL_SENDER_DOMAIN = '@send.catalift.net';

/**
 * Validates that an email sender address uses the correct domain
 * Throws an error if the domain doesn't match @send.catalift.net
 */
export function validateSenderDomain(from: string): void {
  if (!from.includes(EMAIL_SENDER_DOMAIN)) {
    throw new Error(
      `Invalid sender domain. Emails must be sent from ${EMAIL_SENDER_DOMAIN}. ` +
      `Got: ${from}`
    );
  }
}

/**
 * Sends an email using Resend API with domain validation
 * @param apiKey - Resend API key from environment
 * @param options - Email options (to, subject, html)
 * @returns Response from Resend API
 */
export async function sendEmail(
  apiKey: string,
  options: {
    to: string | string[];
    subject: string;
    html: string;
    from?: string; // Optional override, but must be from correct domain
  }
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const sender = options.from || EMAIL_SENDER;
  
  // Safety check: prevent sending from wrong domain
  validateSenderDomain(sender);
  
  if (!apiKey) {
    console.error('[Email] Missing RESEND_API_KEY');
    return { success: false, error: 'Missing API key' };
  }
  
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: sender,
        to: Array.isArray(options.to) ? options.to : [options.to],
        subject: options.subject,
        html: options.html,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Email] Resend API error:', errorText);
      return { success: false, error: errorText };
    }

    const result = await response.json();
    console.log('[Email] Sent successfully:', result.id);
    return { success: true, messageId: result.id };
  } catch (error) {
    console.error('[Email] Failed to send:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: errorMessage };
  }
}
