const fetch = require('node-fetch');
const fs = require('fs');

// Enhanced province mapping with fallback to address parsing
const PROVINCE_MAPPING = {
  NL: ['A'], NS: ['B'], PE: ['C'], NB: ['E'],
  QC: ['G', 'H', 'J'], ON: ['K', 'L', 'M', 'N', 'P'],
  MB: ['R'], SK: ['S'], AB: ['T'], BC: ['V'],
  NT: ['X'], YT: ['Y'], NU: ['X']
};

function detectProvince(club) {
  // Try postal code first
  if (club.postalCode) {
    const prefix = club.postalCode[0]?.toUpperCase();
    for (const [prov, codes] of Object.entries(PROVINCE_MAPPING)) {
      if (codes.includes(prefix)) return prov;
    }
  }

  // Fallback to address parsing
  if (club.address) {
    const provinceMatch = club.address.match(/(AB|BC|MB|NB|NL|NS|NT|NU|ON|PE|QC|SK|YT)/i);
    if (provinceMatch) return provinceMatch[0].toUpperCase();
  }

  return 'Unknown';
}

function processClub(club) {
  const rawCity = club.address?.split(',')?.[0]?.trim() || 'Unknown';
  const province = detectProvince(club);

  return {
    name: club.name.replace(/\|/g, '｜'), // Sanitize markdown
    city: rawCity,
    province,
    postalCode: club.postalCode?.toUpperCase() || 'N/A',
    latitude: club.latitude?.toFixed(6),
    longitude: club.longitude?.toFixed(6),
    website: club.website?.startsWith('http') ? club.website :
      club.website ? `https://${club.website}` : 'N/A'
  };
}

async function fetchCanadianClubs() {
  try {
    let allClubs = [];
    let page = 1;
    let hasNextPage = true;
    let endCursor = null;

    while (hasNextPage) {
      const response = await fetch('https://clubs-api.raspberrypi.org/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            query ($countryCode: String!, $after: String) {
              clubs(
                after: $after,
                filterBy: { countryCode: $countryCode, verified: true }
              ) {
                nodes {
                  name
                  postalCode
                  address
                  latitude
                  longitude
                  website
                }
                pageInfo {
                  endCursor
                  hasNextPage
                }
              }
            }
          `,
          variables: { countryCode: 'CA', after: endCursor }
        })
      });

      const { data, errors } = await response.json();
      if (errors) throw new Error(JSON.stringify(errors));

      const processed = data.clubs.nodes.map(processClub);
      allClubs = [...allClubs, ...processed];

      hasNextPage = data.clubs.pageInfo.hasNextPage;
      endCursor = data.clubs.pageInfo.endCursor;

      console.log(`Processed page ${page++} (${processed.length} clubs)`);
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    // Add URL validation helper
    function safeUrl(url) {
      try {
        return new URL(url);
      } catch {
        return null;
      }
    }

    // Generate markdown
    // Update the markdown generation section
    const mdContent = `# Canadian Code Clubs (${allClubs.length} clubs)\n\n` +
      '| Name | Location | Postal Code | Website | Coordinates |\n' +
      '|------|----------|-------------|---------|-------------|\n' +
      allClubs.map(club => {
        const url = safeUrl(club.website);
        const websiteDisplay = url
          ? `[${url.hostname}](${url.href})`
          : 'N/A';

        return `| ${club.name} | ${club.city}, ${club.province} | ${club.postalCode} | ` +
          `${websiteDisplay} | ${club.latitude}, ${club.longitude} |`;
      }).join('\n');

    fs.writeFileSync('canada_clubs.md', mdContent);

    console.log(`
      Successfully processed ${allClubs.length} clubs
      Provinces: ${[...new Set(allClubs.map(c => c.province))].join(', ')}
      Markdown file: canada_clubs.md
    `);

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

fetchCanadianClubs();

// To explore the full schema and available fields, use the GraphiQL interface at:
// https://clubs-api.raspberrypi.org/