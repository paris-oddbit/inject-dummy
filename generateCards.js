require('dotenv').config();
const axios = require('axios');
const https = require('https');
const { faker } = require('@faker-js/faker');
const { loginAndGetSessionId } = require('./login');

// Track the next available user ID globally
let nextAvailableUserId;
let batchSize = 0; // How many IDs left in the current batch

// Create an https agent that ignores self-signed certificates
const httpsAgent = new https.Agent({
  keepAlive: true,
  rejectUnauthorized: false, // Disable SSL certificate validation
});

// Array of card types with id, name, type, and mode
const cardTypes = [
  { id: '0', name: 'CSN', type: '1', mode: 'C' },
  { id: '1', name: 'CSN Wiegand', type: '10', mode: 'C' },
  { id: '2', name: 'Secure Credential Card (Card)', type: '2', mode: 'S' },
  { id: '3', name: 'Access on Card (Card)', type: '3', mode: 'A' },
  { id: '4', name: 'CSN Mobile', type: '4', mode: 'M' },
  { id: '5', name: 'Wiegand Mobile', type: '5', mode: 'M' },
  { id: '6', name: 'QR', type: '6', mode: 'Q' },
  { id: '7', name: 'BioStar 2 QR', type: '7', mode: 'Q' },
  { id: '8', name: 'Custom Smart Card', type: '13', mode: 'U' },
  {
    id: '9',
    name: 'Access on Card (Template on Mobile)',
    type: '14',
    mode: 'T',
  },
  {
    id: '10',
    name: 'Secure Credential Card (Template on Mobile)',
    type: '15',
    mode: 'T',
  },
];

// Function to generate card collection for bulk creation
function generateCardCollection(cardsPerType, cardIdCounter) {
  let cardCollection = { CardCollection: { rows: [] } };
  let wiegandFormatToggle = 1; // This will toggle between 1 and 4 for wiegand_format_id

  cardTypes.forEach((cardType) => {
    let count = cardsPerType[cardType.id] || 0; // Number of cards to generate for this type
    for (let i = 0; i < count; i++) {
      let cardData = {
        card_id: (cardIdCounter++).toString(),
        card_type: { id: cardType.id, type: cardType.type },
      };

      // Special case for card_type.id == 1 (CSN Wiegand)
      if (cardType.id === '1') {
        cardData.wiegand_format_id = { id: wiegandFormatToggle.toString() };
        wiegandFormatToggle = wiegandFormatToggle === 1 ? 4 : 1; // Toggle wiegand_format_id between 1 and 4
      }

      cardCollection.CardCollection.rows.push(cardData);
    }
  });
  console.log('Card generation data:', JSON.stringify(cardCollection, null, 2));
  return cardCollection;
}

// Function to send the bulk card generation request
async function createCards(sessionId, cardCollection) {
  const cardApiUrl = `${process.env.BASE_URL}${process.env.CARD_GENERATE_ENDPOINT}`;

  try {
    const response = await axios.post(cardApiUrl, cardCollection, {
      headers: {
        'Content-Type': 'application/json',
        'bs-session-id': sessionId,
      },
      httpsAgent, // Attach the custom https agent to bypass SSL validation
    });

    const createdCards = response.data.CardCollection.rows; // Get the created cards
    console.log(
      `Bulk card generation successful: ${createdCards.length} cards created.`
    );
    return createdCards; // Return all generated cards with their IDs
  } catch (error) {
    console.error('Error generating cards:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
      console.error('Response headers:', error.response.headers);
    }
    throw error;
  }
}

// Function to blacklist a card
async function blacklistCard(sessionId, card) {
  const blacklistApiUrl = `${process.env.BASE_URL}${process.env.CARD_BLACKLIST_ENDPOINT}`; // Adjust the blacklist endpoint URL

  const blacklistData = {
    Blacklist: {
      card_id: {
        id: card.card_id, // Use the card ID for blacklisting
      },
    },
  };

  try {
    const response = await axios.post(blacklistApiUrl, blacklistData, {
      headers: {
        'Content-Type': 'application/json',
        'bs-session-id': sessionId,
      },
      httpsAgent,
    });
    console.log(`Card ${card.card_id} blacklisted successfully.`);
    return response.data;
  } catch (error) {
    console.error(`Error blacklisting card ${card.card_id}:`, error.message);
    throw error;
  }
}

// Function to blacklist assigned cards
async function blacklistAssignedCards(sessionId, createdCards, blacklistCount) {
  const cardsToBlacklist = createdCards.slice(0, blacklistCount); // Select the first 'blacklistCount' cards to blacklist

  for (const card of cardsToBlacklist) {
    await blacklistCard(sessionId, card);
  }

  console.log(`${blacklistCount} cards have been blacklisted.`);
}
async function getNextUserId(sessionId) {
  const nextUserIdApiUrl = `${process.env.BASE_URL}${process.env.GET_NEXT_USER_ID_ENDPOINT}`;

  try {
    const response = await axios.get(nextUserIdApiUrl, {
      headers: {
        'bs-session-id': sessionId,
      },
      httpsAgent,
    });
    const nextUserId = response.data.User.user_id; // Assuming the API returns `user_id` in the response
    console.log(`Next user ID retrieved: ${nextUserId}`);
    nextAvailableUserId = nextUserId;
    batchSize = 0; // Reset batch count
    return nextUserId;
  } catch (error) {
    console.error('Error fetching next user ID:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
      console.error('Response headers:', error.response.headers);
    }
    throw error;
  }
}

// Function to get the next unique user ID, fetches a new batch from the API if needed
async function getNextUniqueUserId(sessionId, concurrencyLimit) {
  if (batchSize === 0) {
    await getNextUserId(sessionId); // Fetch new batch of IDs
  }

  const currentUserId = nextAvailableUserId;
  nextAvailableUserId++;
  batchSize++;

  // If we've used all IDs in the current batch, reset the batch counter
  if (batchSize >= concurrencyLimit) {
    batchSize = 0;
  }

  return currentUserId;
}

// Function to create a user and assign the generated card to the user
async function createUserWithCard(sessionId, card, concurrencyLimit) {
  const userApiUrl = `${process.env.BASE_URL}${process.env.USERS_ENDPOINT}`; // Adjust the user creation endpoint

  let nextUserId = await getNextUniqueUserId(sessionId, concurrencyLimit);
  const firstName = faker.person.firstName();

  const generateUserData = () => ({
    User: {
      user_id: nextUserId,
      user_group_id: { id: '1' },
      start_datetime: '2001-01-01T00:00:00.00Z',
      expiry_datetime: '2037-12-31T23:59:00.00Z',
      disabled: '0',
      name: firstName,
      email: faker.internet.email({
        firstName: firstName,
        allowSpecialCharacters: false,
      }),
      department: faker.commerce.department(),
      title: faker.person.jobTitle(),
      photo: '',
      phone: '',
      permission: { id: '1' },
      access_groups: { id: '' },
      login_id: nextUserId,
      password: faker.internet.password({ memorable: true, length: 8 }),
      user_ip: faker.internet.ipv4(),
      cards: [
        {
          card_type: {
            id: card.card_type.id,
            name: card.card_type.name,
            type: card.card_type.type,
          },
          display_card_id: card.display_card_id,
          card_id: card.card_id,
          id: card.id, // Use the ID from the card generation response
        },
      ],
    },
  });
  return retryOperation(async () => {
    try {
      const userData = generateUserData();
      console.log('@USERDATA: ' + JSON.stringify(userData, null, 2));
      const response = await axios.post(userApiUrl, userData, {
        headers: {
          'Content-Type': 'application/json',
          'bs-session-id': sessionId,
        },
        httpsAgent,
      });
      console.log(`User created for card ${card.card_id}`);
      console.log(`Response: ${JSON.stringify(response.data)}`);
      return response.data;
    } catch (error) {
      console.error('Error creating user:', error.message);
      if (error.response) {
        console.error('Response data:', error.response.data);
        console.error('Response status:', error.response.status);
        console.error('Response headers:', error.response.headers);
      }
      throw error;
    }
  });
}
// Helper function to introduce a delay
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Function to process the creation of users and assign them to the generated cards
async function processUsersWithCards(
  sessionId,
  createdCards,
  concurrencyLimit,
  blacklistCount
) {
  // for (let card of createdCards) {
  //   await createUserWithRetry(sessionId, card);
  // }
  const { default: PQueue } = await import('p-queue'); // Dynamically import p-queue
  const queue = new PQueue({ concurrency: concurrencyLimit }); // Create queue with concurrency

  const userCreationPromises = createdCards.map((card) => {
    return queue.add(() =>
      createUserWithRetry(sessionId, card, concurrencyLimit)
    ); // Add the user creation task to the queue
  });

  // Wait for all user creation tasks to complete
  await Promise.all(userCreationPromises);
  console.log('All users have been created and assigned to cards.');

  // Blacklist cards after user creation
  await blacklistAssignedCards(sessionId, createdCards, blacklistCount);
}

// Helper function to retry the operation with exponential backoff
async function retryOperation(operation, retries = 10, delay = 50) {
  let attempt = 0;
  while (attempt < retries) {
    try {
      return await operation(); // Try the operation
    } catch (error) {
      attempt++;
      console.error(`Attempt ${attempt} failed. Retrying in ${delay}ms...`);

      if (attempt === retries) {
        console.error('Max retries reached. Operation failed.');
        throw error; // Throw error if max retries are reached
      }

      await sleep(delay); // Wait for the delay
    }
  }
}

// Function to create a user and assign the generated card to the user with retries
async function createUserWithRetry(sessionId, card) {
  return await retryOperation(() => createUserWithCard(sessionId, card));
}

// Main function to handle login, bulk card generation, and user creation (if required)
async function generateCards(
  assignCards = false,
  blacklistCount = 0,
  concurrencyLimit = 5
) {
  try {
    // Step 1: Login and get session ID
    const sessionId = await loginAndGetSessionId();

    // Step 2: Generate card collection for bulk creation
    const cardsPerType = {
      0: 200, // 1000 cards of card_type id = 0
      // 1: 1000, // 1000 cards of card_type id = 1
      // 2: 1000, // 1000 cards of card_type id = 2
      // 3: 1000, // 1000 cards of card_type id = 3
      // 4: 1000, // 1000 cards of card_type id = 4
      // 5: 1000, // 1000 cards of card_type id = 5
      // 6: 1000, // 1000 cards of card_type id = 6
      // // // 7: 2, // 2 cards of card_type id = 7 //! NOT WORKING
      // 8: 1000, // 1000 cards of card_type id = 8
      // 9: 1000, // 1000 cards of card_type id = 9
      // 10: 1000, // 1000 cards of card_type id = 10
    };
    const cardCollection = generateCardCollection(cardsPerType, cardIdCounter);

    // Step 3: Send the bulk card generation request
    const createdCards = await createCards(sessionId, cardCollection);

    // Step 4: Process cards for user creation and assignment if assignCards is true
    if (assignCards) {
      await processUsersWithCards(
        sessionId,
        createdCards,
        concurrencyLimit,
        blacklistCount
      );
    }
  } catch (error) {
    console.error('Error in main process:', error.message);
  }
}

// Run the main process
// First argument is the number of cards, second argument is whether to assign the cards to users
const assignCards = true; // Change to 'false' for unassigned cards
const blacklistCount = 100; // Number of cards to blacklist
const concurrencyLimit = 5; // Limit for concurrent requests per batch
let cardIdCounter = 1999200; // Start card ID

generateCards(assignCards, blacklistCount, concurrencyLimit);

//! OLD CODE
// require('dotenv').config();
// const axios = require('axios');
// const https = require('https');
// const { faker } = require('@faker-js/faker'); // Updated import for the new Faker library
// const { loginAndGetSessionId } = require('./login');

// // Create an https agent that ignores self-signed certificates
// const httpsAgent = new https.Agent({
//   rejectUnauthorized: false, // Disable SSL certificate validation
// });

// // Array of card types with id, name, type, and mode
// const cardTypes = [
//   { id: '0', name: 'CSN', type: '1', mode: 'C' },
//   { id: '1', name: 'CSN Wiegand', type: '10', mode: 'C' },
//   { id: '2', name: 'Secure Credential Card (Card)', type: '2', mode: 'S' },
//   { id: '3', name: 'Access on Card (Card)', type: '3', mode: 'A' },
//   { id: '4', name: 'CSN Mobile', type: '4', mode: 'M' },
//   { id: '5', name: 'Wiegand Mobile', type: '5', mode: 'M' },
//   { id: '6', name: 'QR', type: '6', mode: 'Q' },
//   { id: '7', name: 'BioStar 2 QR', type: '7', mode: 'Q' },
//   { id: '8', name: 'Custom Smart Card', type: '13', mode: 'U' },
//   {
//     id: '9',
//     name: 'Access on Card (Template on Mobile)',
//     type: '14',
//     mode: 'T',
//   },
//   {
//     id: '10',
//     name: 'Secure Credential Card (Template on Mobile)',
//     type: '15',
//     mode: 'T',
//   },
// ];

// // Helper function to introduce a delay
// function sleep(ms) {
//   return new Promise((resolve) => setTimeout(resolve, ms));
// }

// // Helper function to retry the operation with exponential backoff
// async function retryOperation(operation, retries = 10, delay = 50) {
//   let attempt = 0;
//   while (attempt < retries) {
//     try {
//       return await operation(); // Try the operation
//     } catch (error) {
//       attempt++;
//       console.error(`Attempt ${attempt} failed. Retrying in ${delay}ms...`);

//       if (attempt === retries) {
//         console.error('Max retries reached. Operation failed.');
//         throw error; // Throw error if max retries are reached
//       }

//       await sleep(delay); // Wait for the delay
//       // delay *= 2; // Exponential backoff: double the delay for each retry
//     }
//   }
// }

// // Function to generate a single card
// async function createCard(sessionId, cardType, cardIdCounter) {
//   const cardApiUrl = `${process.env.BASE_URL}${process.env.CARD_GENERATE_ENDPOINT}`;

//   let cardData = {
//     card_id: cardIdCounter.toString(),
//     card_type: { id: cardType.id, type: cardType.type },
//   };

//   if (cardType.id === '1') {
//     // Special case for Wiegand format
//     const wiegandFormatId = cardIdCounter % 2 === 0 ? 1 : 4; // Alternate wiegand format between 1 and 4
//     cardData.wiegand_format_id = { id: wiegandFormatId.toString() };
//   }

//   try {
//     const response = await axios.post(
//       cardApiUrl,
//       { CardCollection: { rows: [cardData] } },
//       {
//         headers: {
//           'Content-Type': 'application/json',
//           'bs-session-id': sessionId,
//         },
//         httpsAgent, // Attach the custom https agent to bypass SSL validation
//       }
//     );

//     const createdCard = response.data.CardCollection.rows[0]; // Get the first created card
//     console.log(`Card created: ${createdCard.card_id}`);
//     return createdCard; // Return card data for further use
//   } catch (error) {
//     console.error('Error creating card:', error.message);
//     if (error.response) {
//       console.error('Response data:', error.response.data);
//       console.error('Response status:', error.response.status);
//       console.error('Response headers:', error.response.headers);
//     }
//     throw error;
//   }
// }

// // Function to create a user and assign the generated card to the user
// async function createUserWithCard(sessionId, card) {
//   const userApiUrl = `${process.env.BASE_URL}${process.env.USERS_ENDPOINT}`;

//   let nextUserId = await getNextUserId(sessionId);
//   const firstName = faker.person.firstName();

//   const generateUserData = () => ({
//     User: {
//       user_id: nextUserId,
//       user_group_id: { id: '1' },
//       start_datetime: '2001-01-01T00:00:00.00Z',
//       expiry_datetime: '2037-12-31T23:59:00.00Z',
//       disabled: '0',
//       name: firstName,
//       email: faker.internet.email({
//         firstName: firstName,
//         allowSpecialCharacters: false,
//       }),
//       department: faker.commerce.department(),
//       title: faker.person.jobTitle(),
//       photo: '',
//       phone: '',
//       permission: { id: '1' },
//       access_groups: { id: '' },
//       login_id: nextUserId,
//       password: faker.internet.password({ memorable: true, length: 8 }),
//       user_ip: faker.internet.ipv4(),
//       cards: [
//         {
//           card_type: {
//             id: card.card_type.id,
//             name: card.card_type.name,
//             type: card.card_type.type,
//           },
//           display_card_id: card.display_card_id,
//           card_id: card.card_id,
//           id: card.id, // Use the ID from the card generation response
//         },
//       ],
//     },
//   });
//   return retryOperation(async () => {
//     try {
//       const userData = generateUserData();
//       console.log('@USERDATA: ' + JSON.stringify(userData, null, 2));
//       const response = await axios.post(userApiUrl, userData, {
//         headers: {
//           'Content-Type': 'application/json',
//           'bs-session-id': sessionId,
//         },
//         httpsAgent,
//       });
//       console.log(`User created for card ${card.card_id}`);
//       console.log(`Response: ${JSON.stringify(response.data)}`);
//       return response.data;
//     } catch (error) {
//       console.error('Error creating user:', error.message);
//       if (error.response) {
//         console.error('Response data:', error.response.data);
//         console.error('Response status:', error.response.status);
//         console.error('Response headers:', error.response.headers);
//       }
//       throw error;
//     }
//   });
// }

// // Function to get the next user ID from the API
// async function getNextUserId(sessionId) {
//   const nextUserIdApiUrl = `${process.env.BASE_URL}${process.env.GET_NEXT_USER_ID_ENDPOINT}`;

//   try {
//     const response = await axios.get(nextUserIdApiUrl, {
//       headers: {
//         'bs-session-id': sessionId,
//       },
//       httpsAgent,
//     });
//     const nextUserId = response.data.User.user_id; // Assuming the API returns `user_id` in the response
//     console.log(`Next user ID retrieved: ${nextUserId}`);
//     return nextUserId;
//   } catch (error) {
//     console.error('Error fetching next user ID:', error.message);
//     if (error.response) {
//       console.error('Response data:', error.response.data);
//       console.error('Response status:', error.response.status);
//       console.error('Response headers:', error.response.headers);
//     }
//     throw error;
//   }
// }

// // Function to process cards and users (if assigned)
// async function processCards(sessionId, cardsPerType, assignCards) {
//   let cardIdCounter = 7225;

//   // For assigned cards, create 1 card then 1 user
//   if (assignCards) {
//     for (const cardTypeId in cardsPerType) {
//       const count = cardsPerType[cardTypeId];
//       const cardType = cardTypes.find((type) => type.id === cardTypeId);

//       for (let i = 0; i < count; i++) {
//         const card = await createCard(sessionId, cardType, cardIdCounter++);
//         setTimeout(() => {}, 1000);
//         await createUserWithCard(sessionId, card); // Create user and assign card
//       }
//     }
//   } else {
//     // For unassigned cards, bulk creation
//     const cardCollection = { CardCollection: { rows: [] } };

//     for (const cardTypeId in cardsPerType) {
//       const count = cardsPerType[cardTypeId];
//       const cardType = cardTypes.find((type) => type.id === cardTypeId);

//       for (let i = 0; i < count; i++) {
//         let cardData = {
//           card_id: (cardIdCounter++).toString(),
//           card_type: { id: cardType.id },
//         };

//         if (cardType.id === '1') {
//           const wiegandFormatId = cardIdCounter % 2 === 0 ? 1 : 4;
//           cardData.wiegand_format_id = { id: wiegandFormatId.toString() };
//         }

//         cardCollection.CardCollection.rows.push(cardData);
//       }
//     }

//     // Bulk creation request
//     const response = await axios.post(
//       `${process.env.BASE_URL}${process.env.CARD_GENERATE_ENDPOINT}`,
//       cardCollection,
//       {
//         headers: {
//           'Content-Type': 'application/json',
//           'bs-session-id': sessionId,
//         },
//         httpsAgent,
//       }
//     );

//     console.log(
//       `Bulk card creation successful: ${response.data.CardCollection.rows.length} cards created.`
//     );
//   }
// }

// // Main function to handle login, card generation, and user creation
// async function generateCards(assignCards = false) {
//   try {
//     // Step 1: Login and get session ID
//     const sessionId = await loginAndGetSessionId();

//     // Step 2: Define how many cards of each type
//     const cardsPerType = {
//       0: 1000, // 2 cards of card_type id = 0
//       1: 1000, // 2 cards of card_type id = 1
//       2: 1000, // 2 cards of card_type id = 2
//       3: 1000, // 2 cards of card_type id = 3
//       4: 1000, // 2 cards of card_type id = 4
//       5: 1000, // 2 cards of card_type id = 5
//       6: 1000, // 2 cards of card_type id = 6
//       // // // 7: 2, // 2 cards of card_type id = 7 //! NOT WORKING
//       8: 1000, // 2 cards of card_type id = 8
//       9: 1000, // 2 cards of card_type id = 9
//       10: 1000, // 2 cards of card_type id = 10
//     };

//     // Step 3: Process cards and users (if assigned)
//     await processCards(sessionId, cardsPerType, assignCards);
//   } catch (error) {
//     console.error('Error in main process:', error.message);
//   }
// }

// // Run the main process
// const assignCards = true; // Set to 'false' for unassigned cards

// generateCards(assignCards);
