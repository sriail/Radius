# Verification Support (reCAPTCHA & Cloudflare Turnstile)

Radius now supports bot protection and verification through reCAPTCHA v3 and Cloudflare Turnstile. This feature helps protect your proxy backend from abuse while maintaining a seamless user experience.

## Table of Contents
- [Overview](#overview)
- [Supported Verification Types](#supported-verification-types)
- [Setup Instructions](#setup-instructions)
  - [reCAPTCHA v3 Setup](#recaptcha-v3-setup)
  - [Cloudflare Turnstile Setup](#cloudflare-turnstile-setup)
- [Configuration](#configuration)
- [How It Works](#how-it-works)
- [Troubleshooting](#troubleshooting)

## Overview

Verification support is integrated into all proxy routing modes (Wisp and Bare) and transport configurations (Epoxy and Libcurl). When enabled, verification tokens are automatically attached to proxy requests, allowing backend services to validate requests.

## Supported Verification Types

### reCAPTCHA v3
- **Type**: Invisible background verification
- **Best for**: Scoring-based bot detection without user interaction
- **Provider**: Google
- **Website**: https://www.google.com/recaptcha/

### Cloudflare Turnstile
- **Type**: Privacy-first CAPTCHA alternative
- **Best for**: Privacy-conscious deployments with flexible challenge modes
- **Provider**: Cloudflare
- **Website**: https://www.cloudflare.com/products/turnstile/

### None (Default)
- **Type**: No verification
- **Best for**: Local development or private deployments

## Setup Instructions

### reCAPTCHA v3 Setup

1. **Get Your Site Key**
   - Visit the [reCAPTCHA Admin Console](https://www.google.com/recaptcha/admin)
   - Create a new site
   - Select **reCAPTCHA v3**
   - Add your domain(s)
   - Copy your **Site Key**

2. **Add reCAPTCHA Script to Your Site**
   
   Add this script to your HTML `<head>` section (in your custom deployment or layout):
   
   ```html
   <script src="https://www.google.com/recaptcha/api.js?render=YOUR_SITE_KEY"></script>
   ```

3. **Configure in Radius**
   - Navigate to **Settings** → **Proxy**
   - Under **Verification Type**, select **reCAPTCHA v3**
   - Enter your **Site Key** in the **Verification Site Key** field
   - Click **Save Verification**

4. **Verify Backend Integration**
   
   Your backend can validate tokens by sending them to Google's verification endpoint:
   
   ```bash
   curl -X POST "https://www.google.com/recaptcha/api/siteverify" \
     -d "secret=YOUR_SECRET_KEY" \
     -d "response=TOKEN_FROM_HEADER"
   ```

### Cloudflare Turnstile Setup

1. **Get Your Site Key**
   - Visit the [Cloudflare Dashboard](https://dash.cloudflare.com/)
   - Navigate to **Turnstile**
   - Create a new site
   - Add your domain(s)
   - Copy your **Site Key**

2. **Add Turnstile Script to Your Site**
   
   Add this script to your HTML `<head>` section:
   
   ```html
   <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
   ```

3. **Configure in Radius**
   - Navigate to **Settings** → **Proxy**
   - Under **Verification Type**, select **Cloudflare Turnstile**
   - Enter your **Site Key** in the **Verification Site Key** field
   - Click **Save Verification**

4. **Verify Backend Integration**
   
   Your backend can validate tokens by sending them to Cloudflare's verification endpoint:
   
   ```bash
   curl -X POST "https://challenges.cloudflare.com/turnstile/v0/siteverify" \
     -d "secret=YOUR_SECRET_KEY" \
     -d "response=TOKEN_FROM_HEADER"
   ```

## Configuration

### Settings Page

Navigate to **Settings** → **Proxy** to configure verification:

1. **Verification Type**: Choose between None, reCAPTCHA v3, or Cloudflare Turnstile
2. **Verification Site Key**: Enter your site key from the respective provider
3. **Save Verification**: Apply your settings
4. **Reset**: Clear verification settings and disable verification

### Verification Headers

When verification is enabled, Radius automatically adds the following headers to proxy requests:

**For reCAPTCHA:**
- `X-Recaptcha-Token`: The verification token
- `X-Recaptcha-Site-Key`: Your site key (optional)

**For Cloudflare Turnstile:**
- `X-Turnstile-Token`: The verification token
- `X-Turnstile-Site-Key`: Your site key (optional)

## How It Works

1. **Token Generation**: When verification is enabled, Radius automatically generates tokens using the configured provider's JavaScript API

2. **Transport Integration**: Tokens are attached to all proxy requests in the configured routing mode (Wisp or Bare) and transport (Epoxy or Libcurl)

3. **Backend Validation**: Your backend server receives the verification headers and can validate them with the respective provider

4. **Automatic Refresh**: Tokens are automatically refreshed as needed to maintain continuous verification

### Request Flow

```
User Request → Radius Client
    ↓
Generate Verification Token (if enabled)
    ↓
Attach Token to Headers
    ↓
Route through Transport (Epoxy/Libcurl)
    ↓
Backend Server Receives Request with Verification Headers
    ↓
Backend Validates Token (optional)
    ↓
Process Request
```

## Troubleshooting

### Verification Not Working

**Issue**: Verification tokens are not being sent

**Solutions**:
- Verify that the verification script is loaded on your page
- Check browser console for JavaScript errors
- Ensure the site key is correct
- Verify that you've saved your verification settings

### Script Loading Errors

**Issue**: reCAPTCHA or Turnstile script fails to load

**Solutions**:
- Check your domain is registered with the provider
- Verify the site key is correct
- Ensure your site uses HTTPS (required by most providers)
- Check for Content Security Policy (CSP) blocking the scripts

### Token Validation Failing

**Issue**: Backend reports invalid tokens

**Solutions**:
- Verify you're using the correct secret key on the backend
- Check that tokens haven't expired (they have a limited lifetime)
- Ensure the domain matches what's registered with the provider
- Verify the token format is correct

### Routing Mode Compatibility

All verification features work with both routing modes:

- ✅ **Wisp Server Mode**: Full support with Epoxy and Libcurl transports
- ✅ **Bare Server Mode**: Full support with Bare transport

### Privacy Considerations

- **reCAPTCHA v3**: Collects user interaction data for scoring. See [Google's Privacy Policy](https://policies.google.com/privacy)
- **Cloudflare Turnstile**: Privacy-focused alternative with minimal data collection. See [Cloudflare's Privacy Policy](https://www.cloudflare.com/privacypolicy/)

## Advanced Configuration

### Environment Variables

The backend server logs verification attempts. You can monitor these in your server logs:

```bash
# Server logs will show:
Verification token received: reCAPTCHA
# or
Verification token received: Turnstile
```

### Custom Validation

To implement custom backend validation, you can access the verification headers in your server code:

```typescript
// Example: Validate reCAPTCHA token
const recaptchaToken = req.headers['x-recaptcha-token'];
if (recaptchaToken) {
  const validation = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    body: `secret=${YOUR_SECRET_KEY}&response=${recaptchaToken}`
  });
  const result = await validation.json();
  if (result.success && result.score > 0.5) {
    // Allow request
  }
}
```

## Additional Resources

- [reCAPTCHA v3 Documentation](https://developers.google.com/recaptcha/docs/v3)
- [Cloudflare Turnstile Documentation](https://developers.cloudflare.com/turnstile/)
- [Radius GitHub Repository](https://github.com/RadiusProxy/Radius)

## Support

For issues or questions about verification support:
- Open an issue on [GitHub](https://github.com/RadiusProxy/Radius/issues)
- Join the [Discord](https://discord.gg/cCfytCX6Sv)
