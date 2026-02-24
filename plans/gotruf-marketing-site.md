# GotRuf.com Marketing Site Plan

## Status: PHASE 1 COMPLETE

## Brand
- **Domain**: GotRuf.com (pronounced "Got Roof")
- **Taglines**: "It sure ain't EagleView." / "Check your receipt." / "Home of the first one's free."
- **Positioning**: EagleView is the Cadillac. GotRuf is the Honda Accord. Gets you there. Every time.
- **Color**: Orange (#F97316) brand color, white/light marketing pages

## Completed

### Phase 1: Marketing Pages (COMPLETE)
- [x] Brand colors added to CSS theme (`gotruf-50` through `gotruf-950`)
- [x] Marketing layout with responsive nav + footer (`MarketingLayout.tsx`)
- [x] Mobile hamburger menu with slide-out panel
- [x] Landing page with hero, comparison, audience cards, features, accuracy guarantee, CTA
- [x] Contractors persona page — pain points, ROI calculator, features
- [x] Adjusters persona page — accuracy, compliance, workflow scenario
- [x] Agents persona page — enterprise features, cost comparison table
- [x] Homeowners persona page — plain English explanations, trust section
- [x] Pricing page — 3 tiers ($9.99, $99/mo, Enterprise), FAQ, guarantee
- [x] Signup page — account creation form with free report incentive
- [x] Routes wired in App.tsx under `/gotruf/*` (public, no auth required)
- [x] TypeScript compiles clean
- [x] All 1399 existing tests pass

### Files Created
- `src/pages/marketing/MarketingLayout.tsx` — Shared layout with nav + footer
- `src/pages/marketing/LandingPage.tsx` — Main landing page
- `src/pages/marketing/ContractorsPage.tsx` — Contractor persona
- `src/pages/marketing/AdjustersPage.tsx` — Adjuster persona
- `src/pages/marketing/AgentsPage.tsx` — Agent persona
- `src/pages/marketing/HomeownersPage.tsx` — Homeowner persona
- `src/pages/marketing/PricingPage.tsx` — Pricing tiers + FAQ
- `src/pages/marketing/SignupPage.tsx` — Account creation

### Files Modified
- `src/index.css` — Added GotRuf brand color palette
- `src/App.tsx` — Added marketing route tree under `/gotruf`

## Remaining Work

### Phase 2: Stripe Integration
- [ ] Install `@stripe/stripe-js` and `@stripe/react-stripe-js`
- [ ] Create Stripe products and prices in Stripe Dashboard
- [ ] Backend: `POST /api/checkout/session` to create Stripe Checkout sessions
- [ ] Backend: Stripe webhook handler for `checkout.session.completed`
- [ ] Wire pricing page buttons to Stripe Checkout
- [ ] Track report credits per user in database

### Phase 3: Domain & Deployment
- [ ] Point GotRuf.com DNS to Hetzner VPS (89.167.94.69)
- [ ] Configure nginx for GotRuf.com with SSL (Let's Encrypt)
- [ ] Add `gotruf.com` and `www.gotruf.com` to Google Maps API key allowed referrers
- [ ] Add `gotruf.com` to CORS allowed origins on backend
- [ ] Configure SPA routing fallback in nginx

### Phase 4: Polish
- [ ] GotRuf logo design (currently text-only)
- [ ] Open Graph / social meta tags for sharing
- [ ] Analytics (Google Analytics or Plausible)
- [ ] SEO: meta descriptions, structured data
- [ ] Contact form / live chat integration
- [ ] Email collection for waitlist/newsletter

## Pricing Structure
| Plan | Price | Reports | Per Report |
|------|-------|---------|------------|
| Pay Per Report | $9.99 | 1 | $9.99 |
| Pro Plan | $99/mo | 25 (roll over, max 75) | $3.96 |
| Enterprise | Custom | Custom | Volume discount |
| First Report | Free | 1 | $0.00 |

## Accuracy Guarantee
Within 5% of EagleView measurements or full refund. No questions asked.
