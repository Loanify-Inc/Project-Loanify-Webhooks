const https = require('https');

// Function to convert state to capitalized abbreviation
function getStateAbbreviation(state) {
  const stateMap = {
    alabama: 'AL',
    alaska: 'AK',
    arizona: 'AZ',
    arkansas: 'AR',
    california: 'CA',
    colorado: 'CO',
    connecticut: 'CT',
    delaware: 'DE',
    florida: 'FL',
    georgia: 'GA',
    hawaii: 'HI',
    idaho: 'ID',
    illinois: 'IL',
    indiana: 'IN',
    iowa: 'IA',
    kansas: 'KS',
    kentucky: 'KY',
    louisiana: 'LA',
    maine: 'ME',
    maryland: 'MD',
    massachusetts: 'MA',
    michigan: 'MI',
    minnesota: 'MN',
    mississippi: 'MS',
    missouri: 'MO',
    montana: 'MT',
    nebraska: 'NE',
    nevada: 'NV',
    newhampshire: 'NH',
    newjersey: 'NJ',
    newmexico: 'NM',
    newyork: 'NY',
    northcarolina: 'NC',
    northdakota: 'ND',
    ohio: 'OH',
    oklahoma: 'OK',
    oregon: 'OR',
    pennsylvania: 'PA',
    puertorico: 'PR',
    rhodeisland: 'RI',
    southcarolina: 'SC',
    southdakota: 'SD',
    tennessee: 'TN',
    texas: 'TX',
    utah: 'UT',
    vermont: 'VT',
    virginia: 'VA',
    washington: 'WA',
    westvirginia: 'WV',
    wisconsin: 'WI',
    wyoming: 'WY'
  };

  // Normalize input: Convert full state names to lowercase, and abbreviations to uppercase
  let normalizedState = state.length > 2 ? state.toLowerCase() : state.toUpperCase();

  // Return the uppercase abbreviation for full state names
  if (normalizedState.length > 2) {
    return stateMap[normalizedState] || '';
  }

  // Return the uppercase abbreviation directly for abbreviation inputs
  return normalizedState;
}

// Function to format date of birth as "YYYY-MM-DD"
function formatDateOfBirth(dateOfBirth) {
  // Check if the date is already in the correct format "YYYY-MM-DD"
  const isoRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (isoRegex.test(dateOfBirth)) {
    return dateOfBirth; // Return as is if already in correct format
  }

  // Regular expression to match dates in various formats
  const verboseRegex = /^(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s(\d{1,2})(?:st|nd|rd|th)?\s(\d{4})$/;
  const match = dateOfBirth.match(verboseRegex);

  if (match) {
    const monthNames = {
      "January": "01", "February": "02", "March": "03", "April": "04", "May": "05", "June": "06",
      "July": "07", "August": "08", "September": "09", "October": "10", "November": "11", "December": "12",
      "Jan": "01", "Feb": "02", "Mar": "03", "Apr": "04", "Jun": "06", "Jul": "07", "Aug": "08",
      "Sep": "09", "Oct": "10", "Nov": "11", "Dec": "12"
    };

    const month = monthNames[match[1]];
    const day = match[2].padStart(2, '0');
    const year = match[3];

    return `${year}-${month}-${day}`;
  }

  // If parsing failed, return an empty string
  return '';
}

// List of qualified states
const qualifiedStates = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'DE', 'GA', 'ID', 'IL',
  'IA', 'LA', 'MA', 'NV', 'NJ', 'OH', 'PA', 'PR', 'RI', 'TN',
  'UT', 'VA', 'WI', 'WY', 'FL', 'IN', 'KY', 'ME', 'MD', 'MI',
  'MN', 'MS', 'MO', 'MT', 'NE', 'NH', 'NM', 'NY', 'NC', 'OK',
  'SD', 'TX', 'DC'
];

exports.handler = async (event, context) => {
  const API_KEY = process.env.API_KEY;
  const BASE_URL = 'api.forthcrm.com';
  const API_PATH = '/v1/contacts';

  // Parse the incoming request body to extract contact data
  const body = JSON.parse(event.body);

  // Check for missing required information
  const missingFields = [];
  ['first_name', 'last_name', 'address', 'date_of_birth', 'phone_number', 'email'].forEach(field => {
    if (!body[field]) {
      missingFields.push(field);
    }
  });

  // Convert the list of missing fields to a single string
  const missingFieldsString = missingFields.join(', ');

  // Convert state name to capitalized abbreviation
  const stateAbbreviation = getStateAbbreviation(body.address?.state);

  // Check if the state is qualified and store the result as a string
  const qualificationStatus = qualifiedStates.includes(stateAbbreviation) ? "Qualified" : "Not Qualified";

  // If the state is not qualified or there are missing fields, return a structured response
  if (qualificationStatus === "Not Qualified" || missingFields.length > 0) {
    return {
      statusCode: 200,
      body: JSON.stringify({
        isStateQualified: qualificationStatus,
        missingInformation: missingFields.length > 0 ? missingFieldsString : null,
        message: qualificationStatus === "Not Qualified"
          ? `State ${stateAbbreviation} is not qualified for processing.`
          : "Missing required information.",
        response: {
          response: {
            id: null
          }
        }
      }),
      headers: { 'Access-Control-Allow-Origin': '*' },
    };
  }

  // Format date of birth as "year-month-day"
  const formattedDateOfBirth = formatDateOfBirth(body.date_of_birth);

  // Construct the request body for the Forth API call using the extracted data
  const forthRequestBody = {
    assigned_to: body.assigned_to,
    first_name: body.first_name,
    last_name: body.last_name,
    campaign_id: body.campaign_id,
    attorney_id: body.attorney_id,
    phone_number: body.phone_number,
    address: {
      address1: body.address.address1,
      address2: body.address.address2 || '', // Make address2 optional
      address3: body.address.address3 || '', // Make address3 optional
      city: body.address.city,
      state: stateAbbreviation, // Use the capitalized state abbreviation
      zip: body.address.zip,
    },
    email: body.email,
    social_security_number: body.social_security_number,
    date_of_birth: formattedDateOfBirth, // Use the formatted date of birth
    statusID: body.statusID,
    stageID: body.stageID,
    stage_label: body.stage_label,
    status_label: body.status_label,
  };

  const requestOptions = {
    hostname: BASE_URL,
    path: API_PATH,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'API-Key': API_KEY,
    },
  };

  try {
    const response = await performHttpRequest(requestOptions, forthRequestBody);
    console.log('API Response:', response);

    // Handle the API response as needed

    return {
      statusCode: 200,
      body: JSON.stringify({
        isStateQualified: qualificationStatus,
        missingInformation: null,
        message: 'API call to Forth successful',
        response: response
      }),
      headers: { 'Access-Control-Allow-Origin': '*' },
    };
  } catch (error) {
    console.error('Error:', error.message);

    // Check if the error is in the expected format (Forth's response)
    if (error.status && error.status.code && error.status.message) {
      // Extract the error message from the error object
      const errorMessage = error.status.message;

      // Format the error message as needed
      const formattedErrorMessage = {
        error: errorMessage,
      };

      return {
        statusCode: error.status.code,
        body: JSON.stringify(formattedErrorMessage),
        headers: { 'Access-Control-Allow-Origin': '*' },
      };
    } else {
      // If the error is not in the expected format, return a generic error message
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'An unexpected error occurred' }),
        headers: { 'Access-Control-Allow-Origin': '*' },
      };
    }
  }
};

function performHttpRequest(options, requestBody) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          if (res.statusCode === 200) {
            const parsedData = JSON.parse(data);
            resolve(parsedData);
          } else {
            reject({ statusCode: res.statusCode, message: data });
          }
        } catch (error) {
          reject({ statusCode: 500, message: "Failed to parse JSON response" });
        }
      });
    });

    req.on('error', (error) => {
      reject({ statusCode: 500, message: error.message });
    });

    req.write(JSON.stringify(requestBody));
    req.end();
  });
}




