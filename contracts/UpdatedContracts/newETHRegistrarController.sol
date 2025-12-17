pragma solidity >=0.8.4;

import "./PriceOracle.sol";
import "../ethregistrar/BaseRegistrarImplementation.sol";
import "../ethregistrar/StringUtils.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../resolvers/Resolver.sol";

import "../reverseRegistrar/IReverseRegistrar.sol";
import "../reverseRegistrar/ReverseRegistrar.sol";
import "../reverseRegistrar/ReverseClaimer.sol";

// import {BaseRegistrarImplementation} from "../ethregistrar/BaseRegistrarImplementation.sol";
/**
 * @dev A registrar controller for registering and renewing names at fixed cost.
 */
contract newETHRegistrarController is Ownable {
    using StringUtils for *;

    uint public constant MIN_REGISTRATION_DURATION = 28 days;

    bytes4 private constant INTERFACE_META_ID =
        bytes4(keccak256("supportsInterface(bytes4)"));
    // bytes4 private constant COMMITMENT_CONTROLLER_ID =
    //     bytes4(
    //         keccak256("rentPrice(string,uint256)") ^
    //             keccak256("available(string)") ^
    //             keccak256("makeCommitment(string,address,bytes32)") ^
    //             keccak256("commit(bytes32)") ^
    //             keccak256("register(string,address,uint256,bytes32)") ^
    //             keccak256("renew(string,uint256)")
    //     );

    // bytes4 private constant COMMITMENT_WITH_CONFIG_CONTROLLER_ID =
    //     bytes4(
    //         keccak256(
    //             "registerWithConfig(string,address,uint256,bytes32,address,address)"
    //         ) ^
    //             keccak256(
    //                 "makeCommitmentWithConfig(string,address,bytes32,address,address)"
    //             )
    //     );
    ReverseRegistrar reverseRegistrar;
    BaseRegistrarImplementation base;
    PriceOracle prices;
    // uint public minCommitmentAge;
    // uint public maxCommitmentAge;

    event NameRegistered(
        string name,
        bytes32 indexed label,
        address indexed owner,
        uint basecost,
        uint premium,
        uint expires
    );
    event NameRenewed(
        string name,
        bytes32 indexed label,
        uint cost,
        uint expires
    );
    event NewPriceOracle(address indexed oracle);

    constructor(
        BaseRegistrarImplementation _base,
        PriceOracle _prices, // uint _minCommitmentAge, // uint _maxCommitmentAge
        ReverseRegistrar _reverseRegistrar
    ) public {
        // require(_maxCommitmentAge > _minCommitmentAge);

        base = _base;
        prices = _prices;
        reverseRegistrar = _reverseRegistrar;
        // minCommitmentAge = _minCommitmentAge;
        // maxCommitmentAge = _maxCommitmentAge;
    }

    function rentPrice(
        string memory name,
        uint duration
    ) public view returns (PriceOracle.Price memory) {
        bytes32 hash = keccak256(bytes(name));
        return prices.price(name, base.nameExpires(uint256(hash)), duration);
    }

    function valid(string memory name) public pure returns (bool) {
        return name.strlen() >= 3;
    }

    function available(string memory name) public view returns (bool) {
        bytes32 label = keccak256(bytes(name));
        return valid(name) && base.available(uint256(label));
    }

    // function makeCommitment(
    //     string memory name,
    //     address owner,
    //     bytes32 secret
    // ) public pure returns (bytes32) {
    //     return
    //         makeCommitmentWithConfig(
    //             name,
    //             owner,
    //             secret,
    //             address(0),
    //             address(0)
    //         );
    // }

    // function makeCommitmentWithConfig(
    //     string memory name,
    //     address owner,
    //     bytes32 secret,
    //     address resolver,
    //     address addr
    // ) public pure returns (bytes32) {
    //     bytes32 label = keccak256(bytes(name));
    //     if (resolver == address(0) && addr == address(0)) {
    //         return keccak256(abi.encodePacked(label, owner, secret));
    //     }
    //     require(resolver != address(0));
    //     return
    //         keccak256(abi.encodePacked(label, owner, resolver, addr, secret));
    // }

    // function commit(bytes32 commitment) public {
    //     require(commitments[commitment] + maxCommitmentAge < block.timestamp);
    //     commitments[commitment] = block.timestamp;
    // }

    function register(
        string calldata name,
        address owner,
        uint duration
    ) external payable {
        registerWithConfig(
            name,
            owner,
            duration,
            address(0),
            address(0),
            false
        );
    }

    function registerWithConfig(
        string memory name,
        address owner,
        uint duration,
        address resolver,
        address addr,
        bool reverseRecord
    ) public payable {
        // bytes32 commitment = makeCommitmentWithConfig(
        //     name,
        //     owner,
        //     secret,
        //     resolver,
        //     addr
        // );

        require(available(name));
        require(duration >= MIN_REGISTRATION_DURATION);

        PriceOracle.Price memory price = rentPrice(name, duration);
        require(msg.value >= price.base);

        // PriceOracle.Price memory price = _consumeCommitment(
        //     name,
        //     duration,
        //     commitment
        // );

        bytes32 label = keccak256(bytes(name));
        uint256 tokenId = uint256(label);

        uint expires;
        if (resolver != address(0)) {
            // Set this contract as the (temporary) owner, giving it
            // permission to set up the resolver.
            expires = base.register(tokenId, address(this), name, duration);

            // The nodehash of this label
            bytes32 nodehash = keccak256(
                abi.encodePacked(base.baseNode(), label)
            );

            // Set the resolver
            base.dotlabs().setResolver(nodehash, resolver);

            // Configure the resolver
            if (addr != address(0)) {
                Resolver(resolver).setAddr(nodehash, addr);
            }

            if (reverseRecord) {
                _setReverseRecord(name, resolver, msg.sender);
            }

            // Now transfer full ownership to the expeceted owner
            base.reclaim(tokenId, owner);
            base.transferFrom(address(this), owner, tokenId);
        } else {
            require(addr == address(0));
            expires = base.register(tokenId, owner, name, duration);
        }

        emit NameRegistered(
            name,
            label,
            owner,
            price.base,
            price.premium,
            expires
        );

        // Refund any extra payment
        if (msg.value > (price.base + price.premium)) {
            payable(msg.sender).transfer(
                msg.value - (price.base + price.premium)
            );
        }
    }

    function renew(string calldata name, uint duration) external payable {
        PriceOracle.Price memory price = rentPrice(name, duration);
        // if (msg.value < price.base) {
        //     revert InsufficientValue();
        // }
        require(msg.value >= price.base, "Insufficient Value!!");

        bytes32 label = keccak256(bytes(name));
        uint expires = base.renew(uint256(label), duration);

        if (msg.value > price.base) {
            payable(msg.sender).transfer(msg.value - price.base);
        }

        emit NameRenewed(name, label, price.base, expires);
    }

    function setPriceOracle(PriceOracle _prices) public onlyOwner {
        prices = _prices;
        emit NewPriceOracle(address(prices));
    }

    // function setCommitmentAges(
    //     uint _minCommitmentAge,
    //     uint _maxCommitmentAge
    // ) public onlyOwner {
    //     minCommitmentAge = _minCommitmentAge;
    //     maxCommitmentAge = _maxCommitmentAge;
    // }

    function withdraw() public onlyOwner {
        payable(msg.sender).transfer(address(this).balance);
    }

    function supportsInterface(
        bytes4 interfaceID
    ) external pure returns (bool) {
        return interfaceID == INTERFACE_META_ID;
        // interfaceID == COMMITMENT_CONTROLLER_ID ||
        // interfaceID == COMMITMENT_WITH_CONFIG_CONTROLLER_ID;
    }

    // function _consumeCommitment(
    //     string memory name,
    //     uint duration,
    //     bytes32 commitment
    // ) internal returns (PriceOracle.Price memory) {
    //     // Require a valid commitment
    //     require(commitments[commitment] + minCommitmentAge <= block.timestamp);

    //     // If the commitment is too old, or the name is registered, stop
    //     require(commitments[commitment] + maxCommitmentAge > block.timestamp);
    //     require(available(name));

    //     delete (commitments[commitment]);

    //     PriceOracle.Price memory price = rentPrice(name, duration);
    //     require(duration >= MIN_REGISTRATION_DURATION);
    //     require(msg.value >= price.base);

    //     return price;
    // }

    function _setReverseRecord(
        string memory name,
        address resolver,
        address owner
    ) internal {
        reverseRegistrar.setNameForAddr(
            msg.sender,
            owner,
            resolver,
            string.concat(name, ".omni")
        );
    }
}
