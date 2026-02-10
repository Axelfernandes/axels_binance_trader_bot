import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import outputs from '../../../../amplify_outputs.json';

Amplify.configure(outputs);

const client = generateClient();

export default client;
