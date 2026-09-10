import { createFileRoute, Link } from "@tanstack/react-router";

import { LegalPage, LegalSection } from "@/features/legal/legal-page";
import { siteUrl } from "@/lib/site";

const description =
  "Read the Terms of Service for using ExtendShare, its plugin catalog, developer tools, reviews and external listings.";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service | ExtendShare" },
      { name: "description", content: description },
      { property: "og:title", content: "Terms of Service | ExtendShare" },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: siteUrl("/terms") },
    ],
    links: [{ rel: "canonical", href: siteUrl("/terms") }],
  }),
  component: TermsOfService,
});

function TermsOfService() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Terms of Service"
      intro="These terms govern access to the current free version of ExtendShare and its plugin discovery, community and developer features."
    >
      <LegalSection title="1. Operator and acceptance">
        <p>
          ExtendShare is operated by Maciej Pająkiewicz. Contact:{" "}
          <a
            className="text-primary underline underline-offset-4"
            href="mailto:maciejpraktyki@gmail.com"
          >
            maciejpraktyki@gmail.com
          </a>
          . By accessing ExtendShare or creating an account, you agree to these Terms and
          acknowledge the{" "}
          <Link to="/privacy" className="text-primary underline underline-offset-4">
            Privacy Policy
          </Link>
          . If you do not agree, do not create an account or use account-only features.
        </p>
      </LegalSection>

      <LegalSection title="2. The current service">
        <p>
          ExtendShare is currently a free catalog and discovery service for plugins, extensions and
          add-ons. It provides public listings, links to official sources, user reviews, favorites,
          collections, developer profiles and tools for submitting hosted or external plugin
          listings. Payments, paid checkout and payouts are not currently offered under these Terms.
          Features may change as the service develops.
        </p>
      </LegalSection>

      <LegalSection title="3. Accounts">
        <p>
          You must provide accurate account information, keep access to your authentication method
          secure and use one account in good faith. You are responsible for activity performed
          through your account. Notify us promptly if you believe it has been compromised. Usernames
          must not impersonate others, mislead users, infringe rights or contain abusive material.
        </p>
      </LegalSection>

      <LegalSection title="4. Developer profiles and plugin publishing">
        <p>
          A user may create a developer profile and submit plugins they are authorized to distribute
          or represent. Information must be accurate, including identity, compatibility, licensing,
          source links and version details. Submitted files and material may be reviewed, rejected,
          suspended or removed. Approval of a listing does not constitute endorsement or a security
          guarantee.
        </p>
        <p>
          You must not upload malware, deceptive executables, unauthorized copyrighted content,
          credential stealers or code designed to harm users, services or devices. You must not
          replace an approved release with materially different code in order to avoid moderation.
        </p>
      </LegalSection>

      <LegalSection title="5. Reviews and community content">
        <p>
          Reviews and ratings must reflect genuine experience and remain relevant to the plugin. Do
          not manipulate ratings, coordinate fake reviews, post spam, threaten others, disclose
          personal information or submit unlawful content. ExtendShare may moderate, hide or remove
          reviews and other community content when reasonably necessary.
        </p>
      </LegalSection>

      <LegalSection title="6. Imported listings">
        <p>
          Some listings are imported from public or official third-party sources, currently
          including WordPress and Blender. Such listings are identified as external listings and may
          contain source-provided descriptions, media, authorship and statistics. ExtendShare
          attempts to keep them accurate but does not guarantee that source information is complete
          or current.
        </p>
      </LegalSection>

      <LegalSection title="7. Claiming a listing">
        <p>
          A person claiming an imported listing must be the author, rights holder or an authorized
          representative and must provide truthful evidence. False claims and impersonation are
          prohibited. ExtendShare may request additional proof, reject a claim or reverse it where
          ownership cannot be established or a dispute arises.
        </p>
      </LegalSection>

      <LegalSection title="8. Intellectual property and trademarks">
        <p>
          You retain rights in content you submit. You grant ExtendShare a non-exclusive, worldwide,
          royalty-free license to host, reproduce, format and display that content only as needed to
          operate, promote and moderate the service. You confirm that you have the rights needed to
          grant this license. Third-party names, logos and trademarks belong to their respective
          owners and are used for identification; their appearance does not imply endorsement.
        </p>
        <p>
          To report an intellectual-property concern, email the operator with the affected URL, a
          description of the right and evidence that you are authorized to act.
        </p>
      </LegalSection>

      <LegalSection title="9. External websites and downloads">
        <p>
          External listings send users to third-party websites or official marketplaces. ExtendShare
          does not control their availability, terms, privacy, downloads or security. Review the
          destination before downloading or installing software. Hosted downloads are provided as
          submitted and approved, but you remain responsible for evaluating whether a plugin is
          appropriate for your environment and maintaining backups.
        </p>
      </LegalSection>

      <LegalSection title="10. Prohibited use">
        <p>You may not use ExtendShare to:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>distribute malware, exploit code or intentionally unsafe files;</li>
          <li>spam, scrape abusively, overload the service or bypass access controls;</li>
          <li>impersonate a person or organization or submit fraudulent claims;</li>
          <li>manipulate ratings, downloads, views, favorites or other metrics;</li>
          <li>infringe copyright, trademark, privacy or other rights;</li>
          <li>probe private data, interfere with moderation or use the service unlawfully.</li>
        </ul>
      </LegalSection>

      <LegalSection title="11. Moderation, suspension and termination">
        <p>
          ExtendShare may review content, limit features, unpublish listings, remove content, reject
          submissions, suspend plugins or block accounts when reasonably necessary to enforce these
          Terms, protect users, respond to legal requests or maintain service integrity. Where
          practical, context and severity will be considered. You may ask about a moderation
          decision using the contact address above.
        </p>
      </LegalSection>

      <LegalSection title="12. Availability and disclaimers">
        <p>
          ExtendShare is provided on an “as is” and “as available” basis. To the extent permitted by
          law, we make no warranty that listings, statistics, compatibility information, external
          links, downloads or the service will always be accurate, secure, uninterrupted or suitable
          for a particular purpose. Nothing in these Terms excludes rights that cannot legally be
          excluded.
        </p>
      </LegalSection>

      <LegalSection title="13. Limitation of liability">
        <p>
          To the maximum extent permitted by applicable law, the operator is not liable for
          indirect, incidental, special or consequential losses arising from third-party plugins,
          external websites, loss of data, service interruption or use of information from a
          listing. Where liability cannot be excluded, it is limited to the amount reasonably
          attributable to the event under applicable law. Because the current service is free, no
          paid subscription fee is used as a liability measure.
        </p>
      </LegalSection>

      <LegalSection title="14. Changes and governing law">
        <p>
          We may update these Terms as the service changes. The updated date will be shown above.
          Continued use after an update means the revised Terms apply from their effective date.
          These Terms are governed by applicable Polish law, without limiting mandatory consumer or
          data-protection rights available under the law of your residence. Disputes should first be
          raised with the operator in good faith.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
