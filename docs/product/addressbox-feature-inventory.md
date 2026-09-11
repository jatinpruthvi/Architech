# Addressbox feature inventory — initial Chrome inspection

Addressbox presents a top contact bar with email and phone, requirement capture, an investment opportunity link, a Post Property CTA, and a menu/account area. Its main discovery surface supports Residential, Commercial, PG/Co-living, Plot, Land, and Bank Auction Property categories. The hero search combines transaction mode, city, locality/project/developer text search, property-type selection, and a Search CTA.

The homepage also exposes value propositions including Personal Property Manager, Zero Brokerage, and Verified Property Listing. It includes a horizontally browsable partner/developer logo strip, Trending Projects, Top Rated Projects, additional project/property carousels, popular locality SEO links, and multiple intent clusters such as flats for sale, property for sale, ready-to-move homes, new residential flats, and locality-specific searches.

A category click changes the property-type selector and updates the visible discovery content without leaving the homepage. The site uses a persistent right-edge Tell Us Your Requirement CTA. The visible dataset contains project cards with project name, developer, bedroom configurations, property type, locality, pricing or Price on Request, and image links.

The observed Addressbox brand, project names, logos, copy, and imagery are third-party content. Architech will implement equivalent product capabilities with its own Ahmedabad-first data, brand language, UI treatment, and legally sourced assets rather than copying those materials.


## Lower-page and commercial findings

Addressbox’s commercial category resolves into a dedicated SEO landing experience with commercial-specific title and headings. It includes office, shop, showroom, and related commercial inventory; locality clusters such as SG Highway, Nikol, Science City, CG Road, Satellite Road, Sindhubhavan, Ashram Road, Vastral, Gota, and others; a property carousel; a developer/company directory with years active and project counts; and commercial-for-sale SEO links.

The broader page also contains new-project and search-property modules, property-type intent cards, additional locality navigation, developer/project discovery, a Blogs section with buying and renting guides, a News section, and a Zero Brokerage offer module. These indicate a combined marketplace plus programmatic-SEO/content strategy rather than only a hero search interface.

The current commercial page had a scroll position around 2062px with a document height around 5232px in Chrome. The page’s headings include search-intent sections for offices and shops, property-buying guides, rental guides, news, and brand/editorial articles.


## Requirement modal

The observed Zero Brokerage Offer modal is a lead-capture flow. It asks whether the visitor wants to buy or rent, chooses Ahmedabad or Gandhinagar, selects a property type and subtype, enters preferred localities, identifies as Buyer/Owner/Tenant, Agent, or Builder, and collects name plus mobile number before Submit. This should become an Architech requirement drawer with explicit consent copy, validation, rate limiting, masked handling, and no submission during feature inspection.


## Architech implementation verification

Implemented in Architech: category-led market navigation for homes, commercial, PG/co-living, plots, land, and bank auctions; URL-synced buy/rent intent; project and developer discovery rails; locality SEO links; a dedicated developer index; an editorial investment lens; a persistent requirement-capture drawer and `/requirements/` page; and a dedicated `/api/requirements` contract with validation, idempotency, masked phone storage, and mutation-safety enforcement.

Chrome verification passed for `/`, `/requirements/`, `/developers/`, `/investment/`, and `/search/?category=commercial`. New pages rendered with canonical metadata, structured data, existing Header/Footer navigation, and responsive Amdavad Modern styling. The commercial category correctly returned an honest zero-result state because no commercial fixture inventory is currently verified.

Windows synchronization completed into `E:\\Jatin-Project\\Broker\\BrainStrom\\Architech-web`; the local server restarted on port 3000. Sandbox checks passed: lint, TypeScript, 242 unit tests across 51 test files, production build, and the existing 9-route raw HTML SEO smoke suite.
