const https = require('https');

const auth = 'ALGA00012:' + 'd395112ab45cf4a2cfa734a478e699b6964b4281fa47aebc069ce0793cfd1b45';
const options = {
    hostname: 'fleetapi-pt.cartrack.com',
    path: '/rest/vehicles?per_page=1',
    method: 'GET',
    headers: {
        'Authorization': 'Basic ' + Buffer.from(auth).toString('base64')
    }
};

const req = https.request(options, res => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            const item = json.data[0];
            console.log('KEYS:', Object.keys(item));
            if (item.last_pos) console.log('LAST_POS:', item.last_pos);
            if (item.position) console.log('POSITION:', item.position);
            console.log('FULL_ITEM:', JSON.stringify(item, null, 2));
        } catch (e) {
            console.error('Error parsing JSON:', e);
            console.log('RAW:', data.substring(0, 500));
        }
    });
});

req.on('error', error => {
    console.error(error);
});

req.end();
