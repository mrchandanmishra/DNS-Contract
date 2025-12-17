pragma solidity >=0.8.4;

import "./DotLabs.sol";

/**
 * A registrar that allocates subdomains to the first person to claim them.
 */
contract FIFSRegistrar {
    DotLabs dotlabs;
    bytes32 rootNode;

    modifier only_owner(bytes32 label) {
        address currentOwner = dotlabs.owner(
            keccak256(abi.encodePacked(rootNode, label))
        );
        require(currentOwner == address(0x0) || currentOwner == msg.sender);
        _;
    }

    /**
     * Constructor.
     * @param DotLabsAddr The address of the dotlabs registry.
     * @param node The node that this registrar administers.
     */
    constructor(DotLabs DotLabsAddr, bytes32 node) public {
        dotlabs = DotLabsAddr;
        rootNode = node;
    }

    /**
     * Register a name, or change the owner of an existing registration.
     * @param label The hash of the label to register.
     * @param owner The address of the new owner.
     */
    function register(bytes32 label, address owner) public only_owner(label) {
        dotlabs.setSubnodeOwner(rootNode, label, owner);
    }
}
