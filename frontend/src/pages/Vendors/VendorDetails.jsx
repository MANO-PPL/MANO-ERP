import React from 'react';
import PartyDetails from '../../components/PartyDetails';

const VendorDetails = ({ vendor, ...props }) => (
    <PartyDetails party={vendor} partyType="vendor" {...props} />
);

export default VendorDetails;
