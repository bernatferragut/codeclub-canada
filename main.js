const PROVINCE_CODES = {
    'A': 'NL', 'B': 'NS', 'C': 'PE', 'E': 'NB',
    'G': 'QC', 'H': 'QC', 'J': 'QC', 'K': 'ON',
    'L': 'ON', 'M': 'ON', 'N': 'ON', 'P': 'ON',
    'R': 'MB', 'S': 'SK', 'T': 'AB', 'V': 'BC',
    'X': 'NT', 'Y': 'YT'
};

function getProvince(postalCode) {
    if (!postalCode) return 'Unknown';
    const prefix = postalCode[0]?.toUpperCase();
    return PROVINCE_CODES[prefix] || 'Unknown';
}

function safeUrl(url) {
    try {
        return new URL(url);
    } catch {
        return null;
    }
}

async function fetchClubs() {
    const button = document.querySelector('button');
    const loading = document.querySelector('.loading');
    const errorDiv = document.getElementById('error');
    const results = document.getElementById('results');

    // Reset state
    button.disabled = true;
    loading.style.display = 'block';
    errorDiv.textContent = '';
    results.innerHTML = '';

    let hasNextPage = true;
    let endCursor = null;
    const PAGE_SIZE = 100;
    const allClubs = [];

    try {
        while (hasNextPage) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);

            const response = await fetch('https://clubs-api.raspberrypi.org/graphql', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: `
                        query ($countryCode: String!, $after: String, $first: Int!) {
                            clubs(
                                after: $after,
                                first: $first,
                                filterBy: { countryCode: $countryCode, verified: false }
                            ) {
                                nodes {
                                    name
                                    postalCode
                                    address1
                                    address2
                                    email
                                    startTime
                                    endTime
                                    day
                                    frequency
                                    frequencyNote
                                    attendanceType
                                    brand
                                    stage
                                    latitude
                                    longitude
                                    website
                                    municipality
                                    administrativeArea
                                    venueName
                                    venueType
                                    openToPublic
                                    lookingForVolunteers
                                }
                                pageInfo {
                                    endCursor
                                    hasNextPage
                                }
                            }
                        }
                    `,
                    variables: {
                        countryCode: 'CA',
                        after: endCursor,
                        first: PAGE_SIZE
                    }
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP error: ${response.status}`);
            }

            const { data, errors } = await response.json();
            if (errors) throw new Error(JSON.stringify(errors));

            console.log(data); // Log the API response
            console.log(`hasNextPage: ${data.clubs.pageInfo.hasNextPage}, endCursor: ${data.clubs.pageInfo.endCursor}`); // Log pagination info

            const processed = data.clubs.nodes.map(club => {
                // Address composition
                const address = [club.address1, club.address2]
                    .filter(Boolean)
                    .join(', ') || 'Not specified';

                // Website validation
                const url = safeUrl(club.website);
                
                return {
                    name: club.name || 'Unnamed Club',
                    postalCode: club.postalCode?.toUpperCase() || 'N/A',
                    address: address,
                    municipality: club.municipality || 'N/A',
                    province: club.administrativeArea || getProvince(club.postalCode),
                    venue: club.venueName ? 
                        `${club.venueName} (${club.venueType || 'Unknown'})` : 'Not specified',
                    coordinates: club.latitude && club.longitude ?
                        `${club.latitude.toFixed(6)}, ${club.longitude.toFixed(6)}` : 'N/A',
                    website: url?.href || null,
                    websiteHost: url?.hostname || 'N/A',
                    publicAccess: club.openToPublic ? 'Yes' : 'No',
                    volunteersNeeded: club.lookingForVolunteers ? 'Yes' : 'No',
                    meetingFrequency: club.frequency || 'Not specified',
                    email: club.email || 'N/A',
                    startTime: club.startTime || 'N/A',
                    endTime: club.endTime || 'N/A',
                    day: club.day || 'N/A',
                    frequencyNote: club.frequencyNote || 'N/A',
                    attendanceType: club.attendanceType || 'N/A',
                    brand: club.brand || 'N/A',
                    stage: club.stage || 'N/A'
                };
            });

            allClubs.push(...processed);
            hasNextPage = data.clubs.pageInfo.hasNextPage;
            endCursor = data.clubs.pageInfo.endCursor;
        }

        // Convert the data to CSV format using PapaParse
        const csv = Papa.unparse(allClubs);

        // Create a Blob from the CSV data
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });

        // Create a link element to download the CSV file
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'clubs.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        console.log('Data has been written to clubs.csv');

        displayResults(allClubs);
    } catch (error) {
        errorDiv.textContent = `Error: ${error.message}`;
        console.error('Fetch error:', error);
    } finally {
        button.disabled = false;
        loading.style.display = 'none';
    }
}

function displayResults(clubs) {
    const tableHtml = `
        <table>
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Address</th>
                    <th>Municipality</th>
                    <th>Province</th>
                    <th>Postal Code</th>
                    <th>Venue</th>
                    <th>Coordinates</th>
                    <th>Website</th>
                    <th>Public Access</th>
                    <th>Volunteers Needed</th>
                    <th>Meeting Frequency</th>
                    <th>Email</th>
                    <th>Start Time</th>
                    <th>End Time</th>
                    <th>Day</th>
                    <th>Frequency Note</th>
                    <th>Attendance Type</th>
                    <th>Brand</th>
                    <th>Stage</th>
                </tr>
            </thead>
            <tbody>
                ${clubs.map(club => `
                    <tr>
                        <td>${club.name}</td>
                        <td>${club.address}</td>
                        <td>${club.municipality}</td>
                        <td>${club.province}</td>
                        <td>${club.postalCode}</td>
                        <td>${club.venue}</td>
                        <td>${club.coordinates}</td>
                        <td>${club.website ? 
                            `<a href="${club.website}" target="_blank">${club.websiteHost}</a>` : 
                            'N/A'}</td>
                        <td>${club.publicAccess}</td>
                        <td>${club.volunteersNeeded}</td>
                        <td>${club.meetingFrequency}</td>
                        <td>${club.email}</td>
                        <td>${club.startTime}</td>
                        <td>${club.endTime}</td>
                        <td>${club.day}</td>
                        <td>${club.frequencyNote}</td>
                        <td>${club.attendanceType}</td>
                        <td>${club.brand}</td>
                        <td>${club.stage}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;

    document.getElementById('results').innerHTML = tableHtml;
}