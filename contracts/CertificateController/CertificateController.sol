pragma solidity 0.5.10;

import "../mocks/CertificateControllerMock.sol";


contract CertificateController is CertificateControllerMock {

  constructor(address _certificateSigner, bool activated) public CertificateControllerMock(_certificateSigner, activated) {}

}
