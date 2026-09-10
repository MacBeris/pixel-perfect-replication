import { createFileRoute, Link } from "@tanstack/react-router";

import { LegalPage, LegalSection } from "@/features/legal/legal-page";
import { siteUrl } from "@/lib/site";

const description =
  "Read the ExtendShare Privacy Policy, including how account, Google Sign-In, marketplace and analytics data is handled.";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy | ExtendShare" },
      { name: "description", content: description },
      { property: "og:title", content: "Privacy Policy | ExtendShare" },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: siteUrl("/privacy") },
    ],
    links: [{ rel: "canonical", href: siteUrl("/privacy") }],
  }),
  component: PrivacyPolicy,
});

function PrivacyPolicy() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Privacy Policy"
      intro="This policy explains what information ExtendShare processes, why it is used, and the choices available to you when using the service."
    >
      <LegalSection title="1. Who operates ExtendShare">
        <p>
          ExtendShare is operated by Maciej Pająkiewicz. For privacy questions or requests, contact{" "}
          <a
            className="text-primary underline underline-offset-4"
            href="mailto:maciejpraktyki@gmail.com"
          >
            maciejpraktyki@gmail.com
          </a>
          . For GDPR purposes, the operator acts as the controller of personal data processed for
          ExtendShare.
        </p>
      </LegalSection>

      <LegalSection title="2. Information we process">
        <p>Depending on how you use ExtendShare, we may process:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>account information such as email address, username, display name and avatar;</li>
          <li>
            public user and developer profile information, descriptions, websites and social links;
          </li>
          <li>reviews, ratings, favorites and collections you create;</li>
          <li>plugin claims, reports, supporting links and messages submitted to moderators;</li>
          <li>
            plugin listings, versions, uploaded assets, compatibility and publishing information;
          </li>
          <li>security, authentication and operational records needed to run the service;</li>
          <li>
            with optional analytics consent, visited public paths, external referrer host, a
            pseudonymous visitor/session identifier and aggregated interaction events.
          </li>
        </ul>
        <p>
          Wishlist functionality has been retired. ExtendShare does not currently accept new
          wishlist entries. References may remain in historical database migrations or analytics
          type definitions, but the current product and production database do not provide a
          wishlist.
        </p>
      </LegalSection>

      <LegalSection title="3. Google Sign-In and account authentication">
        <p>
          ExtendShare supports account authentication through Supabase Auth, including Google
          Sign-In. When you choose Google Sign-In, Google and Supabase may provide basic identity
          information needed to authenticate and create your account, such as your Google account
          identifier, email address, name and profile picture.
        </p>
        <p>
          We use this information only for sign-in, account operation and displaying the profile
          information associated with your activity. ExtendShare does not request access to Gmail,
          Google Drive or Google Contacts, and does not sell data received from Google. Email and
          password authentication, where offered, is handled by Supabase Auth; ExtendShare does not
          store readable passwords.
        </p>
      </LegalSection>

      <LegalSection title="4. Profiles, community activity and publishing">
        <p>
          Usernames, display names and avatars may appear publicly next to reviews. Public developer
          profiles and published plugin information are visible to anyone. Private developer
          evidence, moderation notes and account details are limited according to database access
          controls. Claims and reports are used to verify ownership, investigate issues and protect
          the catalog.
        </p>
      </LegalSection>

      <LegalSection title="5. Imported listings and official sources">
        <p>
          ExtendShare imports plugin information from public or official sources, currently
          including WordPress and Blender. Imported records may include public author names, source
          URLs, descriptions, versions, ratings, installation figures and media supplied by those
          sources. Source responses are retained to support accurate normalization, updates and
          auditing. Imported listings remain identified as external and may be claimed by their
          authors. We process this publicly available information based on our legitimate interest
          in maintaining a searchable catalog of publicly available plugin information.
        </p>
      </LegalSection>

      <LegalSection title="6. Analytics">
        <p>
          ExtendShare's first-party analytics uses pseudonymous identifiers to measure website
          usage. The first-party analytics database does not intentionally store raw IP addresses.
          Infrastructure and security providers may process IP addresses as necessary to deliver
          and protect the service. Optional analytics, including Google Analytics, is activated only
          after the user provides the required consent. The first-party analytics excludes known
          bots and signed-in administrators and measures public page views and plugin interactions.
          Developer analytics presents aggregated information and does not reveal a list of
          individual visitors.
        </p>
        <p>
          If you reject optional analytics, Google Analytics, optional public page-view tracking and
          optional plugin view tracking do not start. Functional records may still be created when
          necessary to provide a requested feature—for example, recording an authorized hosted-file
          download so download access and review eligibility can be verified. Changing your choice
          later stops future optional collection but cannot withdraw data already processed.
        </p>
      </LegalSection>

      <LegalSection title="7. Cookies and browser storage">
        <p>
          Essential browser storage is used for authentication sessions, security, interface theme,
          unfinished developer forms and your privacy choice. Optional pseudonymous visitor and
          session identifiers, and Google Analytics storage, are created only after analytics is
          accepted. You can change the optional choice through “Privacy settings” in the footer.
          Blocking essential storage may prevent sign-in or saved preferences from working.
        </p>
      </LegalSection>

      <LegalSection title="8. Service providers and external links">
        <p>
          Supabase provides database, authentication and file-storage infrastructure. Google
          provides Google Sign-In and, after consent, Google Analytics. Cloudflare hosts and
          protects the web application. These providers process data under their own terms and
          applicable data protection commitments. Plugin pages may link to third-party marketplaces,
          websites and downloads. ExtendShare does not control those destinations; their privacy
          policies apply after you leave ExtendShare.
        </p>
      </LegalSection>

      <LegalSection title="9. Purposes and legal bases">
        <p>
          We process account and requested-feature data to provide the service and perform our
          agreement with you. Security, moderation, catalog integrity and abuse prevention are based
          on our legitimate interests and legal obligations where applicable. Optional analytics is
          based on consent, which you may withdraw for future processing at any time.
        </p>
      </LegalSection>

      <LegalSection title="10. International data transfers">
        <p>
          Some service providers used by ExtendShare may process personal data outside the European
          Economic Area. Where required, such transfers are protected using appropriate safeguards
          recognised under applicable data protection law.
        </p>
      </LegalSection>

      <LegalSection title="11. Retention and security">
        <p>
          Account and content data is generally retained while an account or listing remains active
          and as reasonably needed to provide the service. Some moderation, audit, security and
          claim-related records may be retained longer where required to protect users, establish
          claims or meet legal duties. Imported source data is refreshed or retained for catalog
          accuracy. We use access controls, Supabase Row Level Security, private file storage,
          signed download links and server-side authorization checks. No online service can
          guarantee absolute security.
        </p>
      </LegalSection>

      <LegalSection title="12. Your rights">
        <p>
          Subject to applicable law, including the GDPR, you may request access, correction,
          deletion, restriction or portability of your personal data, and may object to certain
          processing or withdraw consent. You may also lodge a complaint with the President of the
          Personal Data Protection Office (UODO), the Polish supervisory authority, or another
          competent data protection authority. Send requests from the email associated with your
          account to{" "}
          <a
            className="text-primary underline underline-offset-4"
            href="mailto:maciejpraktyki@gmail.com"
          >
            maciejpraktyki@gmail.com
          </a>
          . We may need to verify your identity. Some data may be retained where law or legitimate
          legal claims require it.
        </p>
      </LegalSection>

      <LegalSection title="13. Changes and contact">
        <p>
          This policy may be updated as ExtendShare changes. Material updates will be reflected by a
          new date on this page. Questions can be sent to the contact above. See also the{" "}
          <Link to="/terms" className="text-primary underline underline-offset-4">
            Terms of Service
          </Link>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
