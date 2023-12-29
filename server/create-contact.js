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
    wyoming: 'WY',
  };

  // Convert the state to lowercase and get the abbreviation
  const stateAbbreviation = state.toLowerCase();
  return stateMap[stateAbbreviation] || '';
}

// Function to format date of birth as "YYYY-MM-DD"
function formatDateOfBirth(dateOfBirth) {
  // Try parsing the date in different formats
  let parsedDate = new Date(dateOfBirth);
  if (isNaN(parsedDate.getTime())) {
    // Parsing failed, try another format
    parsedDate = new Date(dateOfBirth.replace(/(\d{4})-(\d{2})-(\d{2})/, '$2/$3/$1'));
  }

  // Check if parsing succeeded
  if (!isNaN(parsedDate.getTime())) {
    const year = parsedDate.getFullYear();
    const month = (parsedDate.getMonth() + 1).toString().padStart(2, '0'); // Months are 0-indexed
    const day = parsedDate.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // If parsing still failed, return an empty string
  return '';
}

exports.handler = async (event, context) => {
  const API_KEY = '0db948a6-50f1-d9f3-4579-4f8036dc3830';
  const BASE_URL = 'api.forthcrm.com';
  const API_PATH = '/v1/contacts';

  // Parse the incoming request body to extract contact data
  const body = JSON.parse(event.body);

  // Convert state name to capitalized abbreviation
  const stateAbbreviation = getStateAbbreviation(body.address.state);

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
      body: JSON.stringify({ message: 'API call to Forth successful', response }),
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
        if (res.statusCode === 200) {
          resolve(data);
        } else {
          reject({ statusCode: res.statusCode, message: data });
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




