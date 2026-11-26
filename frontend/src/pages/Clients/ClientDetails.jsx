import React from 'react';
import PartyDetails from '../../components/PartyDetails';

const ClientDetails = ({ client, ...props }) => (
    <PartyDetails party={client} partyType="client" {...props} />
);

export default ClientDetails;
