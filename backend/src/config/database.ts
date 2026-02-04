import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import outputs from '../../../amplify_outputs.json';

// Configure Amplify for backend usage
Amplify.configure(outputs);

// Create client (untyped to avoid rootDir issues with generated schema)
const client = generateClient<any>();

export default client;
