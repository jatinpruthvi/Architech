# Addressbox agent dashboard inventory

Authenticated dashboard opened successfully in Chrome. The left navigation exposes Dashboard, My Inquiry, Buy Subscription, AddressBox Leads, My Listing, NewsPaper Listing, Agent Listing, Owner Listing, AI Features, Bank Auction, Property Tenders, Shortlisted Properties, and Contacted Properties. The header has a profile menu for the signed-in agent and a Post property action.

Dashboard KPIs shown are Total Inquiry, Call Back, Properties List, Deals Closed, and Scheduled Visits. Quick Actions expose My Properties (2), Agent Properties (1904), Owner Properties (25159), NewsPaper Properties (3243), Property Tenders (0), and Bank Auction Properties (146). This establishes the missing Architech agent capability families: inquiry pipeline, subscription/entitlements, multi-source inventory views, AI assistance, auctions/tenders, shortlist/contact history, dashboard KPIs, and profile/account controls.


## My Inquiry

The inquiry route has three tabs: Fresh Inquiry, My Follow-up, and All Leads. It includes a clearable filter count, search by contact number/name/lead ID, Listing Type, Property Type, Locality, Budget, Area, Bedrooms, Lead Source, and Inquiry Date. The results table columns are Actions, Lead ID, Type, Property Type, Locality, Budget, Area, BHK, Property Details, Contact Name, Contact No., Source, and Inquiry Date. The authenticated account currently has no inquiries, so no row actions were available to inspect.


## Subscription and AddressBox Leads

Buy Subscription loads a dedicated subscription-details surface, but the current session returned a loading state without visible plan cards or pricing; it should be treated as an entitlement and payment-gated capability rather than copied as a pricing claim. AddressBox Leads exposes search by contact number or inquiry-by name, Listing Type, Property Type, Locality, Budget, Area, Bedrooms, and Inquiry Date filters. Its table includes Status, Lead ID, Type, Property Type, Locality, Budget, Area, Contact Name, Contact No., and Inquiry Date. The account had no lead rows available for action inspection.


## My Listing and Newspaper Listing

My Listing includes a `+ Post Property` action and filters for Project Name, Listing Type, Property Type, Locality, Budget, Area, Bedrooms, Status, and Posted Date. Its table exposes Action, Property ID, Type, Property Type, Locality, Price, Area, BHK, Project Name, Status, and Posted Date. Newspaper Listing is a separate source view with search by Contact Name/Contact No. and filters for Listing Type, Property Type, Locality, Budget, Area, Bedrooms, and Posted Date. Its table exposes Status, Property ID, Type, Property Type, Locality, Price, Area, BHK, Property Description, Contact Name, Contact No., and Posted Date. Both current views had no rows.


## Agent Listing and Owner Listing

Agent Listing searches Project Name, Contact No., or Agent Name and filters Listing Type, Property Type, Locality, Budget, Area, Bedrooms, and Posted Date. Its table includes Status, Property ID, Type, Property Type, Locality, Price, Area, BHK, Project Name, Agent Name, Contact No., and Posted Date. Owner Listing has the same filter family but searches Project Name, Contact No., or Owner Name and replaces Agent Name with Owner Name. Both are distinct provenance views that should map to Architech source labels and organization-safe access rather than a single undifferentiated inventory table.


## AI Suite

The AI Features page exposes four broker tools. AI Voice Call is marked Live and offers instant lead calling, property-detail briefing, buyer-preference capture, and callback scheduling. Custom Property Video is marked Live and offers cinematic walkthrough templates, 4K rendering, multilingual narration, and branded watermarking. Bulk Messages offers SMS/WhatsApp campaigns, smart segments, auto-reply, and reply detection but is marked Coming soon. Custom Chatbot offers web/social capture, custom training, and lead handoff but is also marked Coming soon. Architech already has an optional AI adapter contract, but it needs an agent-facing AI suite page with honest gated cards and tool entry points.


## Bank Auction and Property Tenders

Bank Auction has filters for Bank Property ID, Property Type, Locality, Budget, Area, and Auction Date. Its table includes Status, Bank Property ID, Property Type, Reserve Price, EMD, Locality, Bank Name, Project Name, Borrower Name, Owner Name, Owner Mobile, EMD End Date, Auction Start, Auction End, and Posted Date. Property Tenders is a card/list workflow with Tender ID / Relevant Words, Select City, Submission End Date, Select Department, Tender Value, Clear, Search, sorting (Price: High to Low), and an Active Tenders count. Both need source-document and deadline-aware models in Architech; they should not be presented as ordinary residential listings.


## Shortlisted and Contacted Properties

Shortlisted Properties is a compact table with Type, Listing, Property, Location, Price, Details, Shortlisted Date, and Action. Contacted Properties is a separate history table with Type, Listing, Property, Location, Price, Details, Contact Name, Contact No., Contacted Date, and Action. Both were empty for the current account, but they define durable agent workflow states that Architech should represent as persisted shortlist and contact events rather than only client-side saved buttons.


## Account menu and contact history

The authenticated profile menu exposes Home, My Profile, Manage Requirements, and Sign Out. The Contacted Properties account contained three real contact-history rows, confirming that this is a persisted CRM-style workflow with contact date, property, location, price, contact identity, and a View action. Personal names and phone numbers were intentionally not copied into project notes. My Profile navigated to `/user/profile`; the page was still loading its profile content during inspection, so no editable fields were changed.


## Manage Requirements

The signed-in profile menu links to `/manage-requirements`, a separate account surface that loads saved requirement briefs. The current page remained at “Loading your requirements…” during inspection, so no edit/delete/status controls were available. This should map to an authenticated Architech requirements inbox with ownership scope, status transitions, consent history, and deletion/revocation controls.


## AI Voice Call detail

The AI Voice Call dashboard includes Batch Call and Call History actions, a selectable date range (Last 24 hours, Last 7 days, Last 30 days, Last 90 days), and analytics for Total Calls, Call Success Rate, Answer Rate, Average Call Duration, Failed Calls, and Conversion Rate. It also presents Daily Call Volume, User Interest Distribution, Call Conversion Funnel, and Disconnection Reasons. The current account has no call data, so the dashboard correctly shows zero metrics and non-destructive empty states. No call was launched.


## AI Video Creation Studio

The authenticated AI Video route is a four-step studio: Select Property, Upload Images, Customize Script, and Select Avatar. It has a `+ Choose Property` entry point and a Created Videos area where completed outputs appear automatically. No property was selected and no video was generated. This should map to an Architech agent media workflow built on the existing upload, moderation, and derivative policy, with AI generation remaining explicitly gated until a provider and cost policy are enabled.

Source inspected: https://www.addressbox.com/agent/menu/ai-features/ai-video


## AI Video access gate

Attempting to choose a property opens a non-destructive “Subscription required” message: the account is currently unsubscribed and is directed to the subscription page or support. The Created Videos section shows an honest “No videos created yet” state. Architech should mirror this pattern with entitlement checks before upload or generation, rather than allowing a fake or unmetered AI workflow.


## Post Property workflow

The agent Post Property flow is a five-stage wizard: Basic Details, Property Details, Amenities, Photos & Videos, and Pricing & Others. The first stage captures Listing Type, City, Property Type, map-based Address / Location, Society/Building/Project Name, Locality, and City, followed by “Next, Add Property Details.” The interface reports 20% progress and loads a map search. No fields were filled and no listing was submitted. Architech’s existing broker listing form should evolve into an equivalent staged wizard with draft persistence, validation per step, media moderation, and explicit publish/review status.


## Property wizard navigation behavior

Clicking the second progress step without completing required basic fields did not advance the wizard; the interface stayed on Basic Details. This confirms step gating and per-stage validation are part of the workflow, not merely visual progress indicators. The loaded first step exposes Sell/Rent, Ahmedabad/Gandhinagar, Residential/Commercial/PG-Co-Living/Plot/Land, residential subtypes, map search, address fields, society/project name, locality, pin code, state, and property description.

## Attached hydration mismatch investigation

The attached report targeted `/dashboard/`. Before the fix, that path rendered Architech's animated not-found page rather than the intended protected broker dashboard. The reported `bis_skin_checked="1"` attributes are not present in application source and are consistent with browser/DOM instrumentation injected before React hydration; the current root layout already uses `suppressHydrationWarning` at the document shell, but that cannot suppress extension mutations on every descendant node. A server-side `/dashboard/` compatibility redirect was added to `/broker/dashboard/`, so the stale not-found client tree is no longer rendered at that URL. After the fix, Chrome followed the redirect to `/broker/dashboard/`, rendered the command-spread dashboard, and the current browser console had no output.
