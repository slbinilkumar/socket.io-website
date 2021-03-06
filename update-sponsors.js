#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const request = require('request-promise');

const filename = 'sponsors.json';
const absoluteFilename = path.resolve(__dirname, filename);

const membersUrl = 'https://opencollective.com/socketio/members/all.json';

const graphqlEndpoint = 'https://api.opencollective.com/graphql/v2';

const graphqlQuery = `query account {
  account(slug: "socketio") {
    members(role: BACKER, limit: 500) {
      nodes {
        tier {
          name
        }
        account {
          name
          slug
          website
          imageUrl
        }
        totalDonations {
          value
        }
        createdAt
      }
    }
  }
}`;

const customLinks = {
  airtract: {
    url: "https://www.airtract.com",
    img: "/images/airtract.jpg",
    alt: "AirTract"
  },
  truevendor: {
    url: "https://www.ramotion.com/agency/ui-ux-design",
    img: "https://images.opencollective.com/truevendor/ddf2f01/logo.png",
    alt: "ui ux design agency"
  },
  pinkelephant: {
    url: "https://akasse-fagforening.dk/",
    img: "/images/a-kasse.png",
    alt: "a-kasse"
  }
}

const nodeToSponsor = node => (customLinks[node.account.slug] || {
  url: node.account.website,
  img: node.account.imageUrl,
  alt: node.account.name
});

const getAllSponsors = async () => {
  const requestOptions = {
    method: 'POST',
    uri: graphqlEndpoint,
    body: { query: graphqlQuery },
    json: true
  };

  const result = await request(requestOptions);
  return result.data.account.members.nodes;
};

const main = async () => {
  console.log(`fetching sponsors from the graphql API`);

  const [ members, sponsors ] = await Promise.all([
    request({
      method: 'GET',
      uri: membersUrl,
      json: true
    }),
    request({
      method: 'POST',
      uri: graphqlEndpoint,
      body: { query: graphqlQuery },
      json: true
    }).then(result => result.data.account.members.nodes)
  ]);

  const activeMembers = new Set();
  members.forEach(member => {
    if (member.isActive && member.profile) {
      const slug = member.profile.substring('https://opencollective.com/'.length);
      activeMembers.add(slug);
    }
  });
  console.log(`${activeMembers.size} active members out of ${members.length}`);

  const activeSponsors = sponsors
    .filter(n => {
      const isSponsor = (!n.tier || n.tier.name === 'sponsors') && n.totalDonations.value >= 100;
      const isActive = activeMembers.delete(n.account.slug);
      const hasWebsite = n.account.website;

      return isSponsor && isActive && hasWebsite;
    })
    .sort((a, b) => {
      const sortByDonation = b.totalDonations.value - a.totalDonations.value;
      if (sortByDonation !== 0) {
        return sortByDonation;
      }
      return a.createdAt.localeCompare(b.createdAt);
    })
    .map(nodeToSponsor);

  fs.writeFileSync(absoluteFilename, JSON.stringify(activeSponsors, null, 2));
  console.log(`content written to ${absoluteFilename}`);
}

main();
