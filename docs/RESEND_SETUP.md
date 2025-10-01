# Resend Email Setup Guide

## Step 1: Create Resend Account

1. Go to https://resend.com
2. Click "Get Started" or "Sign Up"
3. Sign up with your email or GitHub account
4. Verify your email address

## Step 2: Get API Key

1. Log in to your Resend dashboard
2. Go to **API Keys** section
3. Click "Create API Key"
4. Give it a name (e.g., "Auto-Apply Production")
5. Select permissions: **Full Access** or **Sending Access**
6. Click "Create"
7. **Copy the API key** (you won't see it again!)
   - It will look like: `re_123abc...`

## Step 3: Add Domain (Optional but Recommended)

### Option A: Use Resend's Test Domain (Quick Start)
- Resend provides `onboarding@resend.dev` for testing
- **Free tier**: 100 emails/day, 3,000/month
- No domain setup needed
- Perfect for development and testing

### Option B: Use Your Own Domain (Production)
1. In Resend dashboard, go to **Domains**
2. Click "Add Domain"
3. Enter your domain (e.g., `yourdomain.com`)
4. Add the provided DNS records to your domain:
   - **SPF** record
   - **DKIM** records (usually 3)
   - **DMARC** record (optional)
5. Wait for verification (usually a few minutes)
6. Once verified, you can send from `noreply@yourdomain.com`

## Step 4: Configure Railway Environment Variables

Add these to your **Auto-Apply service** in Railway:

```bash
EMAIL_SERVICE=resend
RESEND_API_KEY=re_your_actual_api_key_here
```

### Optional: Custom From Address
If using your own verified domain:
```bash
EMAIL_FROM=Auto-Apply <noreply@yourdomain.com>
```

If using Resend's test domain (or leave blank):
```bash
EMAIL_FROM=Auto-Apply <onboarding@resend.dev>
```

## Step 5: Test Email Sending

1. Deploy your app (Railway auto-deploys when you save variables)
2. Go to your app URL → `/login.html`
3. Enter your email
4. Click "Send Magic Link"
5. **Check your inbox!** 📧

### Debugging

Check Railway logs for:
```
✅ Magic link email sent to user@example.com via Resend (ID: abc123...)
```

If you see errors:
- Verify `RESEND_API_KEY` is correct
- Check Resend dashboard → **Logs** for delivery status
- Make sure `EMAIL_FROM` uses a verified domain or `onboarding@resend.dev`

## Resend Free Tier Limits

- **100 emails/day**
- **3,000 emails/month**
- **1 verified domain**
- **Unlimited team members**

Perfect for:
- ✅ Testing and development
- ✅ Small to medium user base
- ✅ Magic link authentication
- ✅ Application notifications

## Production Considerations

### When to Upgrade:
- Need more than 3,000 emails/month
- Want multiple verified domains
- Need advanced analytics
- Require dedicated IP

### Pricing:
- **Free**: 3,000 emails/month
- **Pro**: $20/month → 50,000 emails
- **Business**: Custom pricing

## Email Best Practices

### Avoid Spam Folder:
1. ✅ Use verified domain (not `onboarding@resend.dev` in production)
2. ✅ Add SPF, DKIM, DMARC records
3. ✅ Keep email content professional
4. ✅ Include unsubscribe option (for marketing emails)
5. ✅ Don't send too many emails too quickly

### Monitor Delivery:
- Check Resend dashboard → **Logs**
- Look for bounces and complaints
- Keep bounce rate < 5%
- Keep complaint rate < 0.1%

## Troubleshooting

### Error: "RESEND_API_KEY not configured"
**Solution:** Add `RESEND_API_KEY` to Railway variables

### Error: "Email address not verified"
**Solution:**
- Use `onboarding@resend.dev` for testing
- Or verify your custom domain in Resend

### Emails not arriving
**Check:**
1. Spam/junk folder
2. Resend logs for delivery status
3. Email address is correct
4. API key has sending permissions

### Rate limiting
**Solution:**
- Free tier: 100/day, 3,000/month
- Upgrade plan if exceeding limits
- Add delay between bulk sends

## Example Email Flow

1. User clicks "Send Magic Link"
2. App calls Resend API
3. Resend sends beautiful HTML email
4. User receives email in ~2-5 seconds
5. User clicks magic link
6. User is authenticated!

## Support

- **Resend Docs**: https://resend.com/docs
- **Status Page**: https://status.resend.com
- **Support**: support@resend.com
- **Discord**: https://discord.gg/resend

---

## Quick Reference

```bash
# Railway Environment Variables
EMAIL_SERVICE=resend
RESEND_API_KEY=re_your_api_key_here
EMAIL_FROM=Auto-Apply <onboarding@resend.dev>  # or your domain
```

**That's it!** Your magic link emails will now be delivered via Resend. 📬🚀
