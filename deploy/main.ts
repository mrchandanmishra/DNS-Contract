const hre = require('hardhat');
require('dotenv').config();
const { ethers } = require('hardhat');
const namehash = require('eth-ens-namehash');
const { keccak256 } = require('js-sha3');

async function main() {
 console.log("🚀 Deployment Started...");

  // ✅ Load Provider & Wallet
  const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  try {
    const blockNumber = await provider.getBlockNumber();
    console.log(`✅ Connected to Blockchain | Latest Block: ${blockNumber}`);
  } catch (error) {
    console.error("❌ RPC Connection Failed! Check your .env RPC_URL.");
    process.exit(1);
  }

  const deployer = wallet.address;
  console.log(`🔹 Deployer Address: ${deployer}`);

  // ✅ Check Deployer Balance
  const deployerBalance = await provider.getBalance(deployer);
  console.log(`🔹 Deployer Balance: ${ethers.utils.formatEther(deployerBalance)} ETH`);
  if (deployerBalance.lt(ethers.utils.parseEther("0.1"))) {
    console.error("❌ Not enough ETH for deployment! Fund your wallet.");
    process.exit(1);
  }

  // ✅ Hash Constants
  const ZERO_HASH = '0x' + '0'.repeat(64);
  const OMNI_KECCAK_HASH = '0x' + keccak256('hemi');
  const REVERSE_KECCAK_HASH = '0x' + keccak256('reverse');
  const ADDR_KECCAK_HASH = '0x' + keccak256('addr');

  const REVERSE_NODE_HASH = namehash.hash('reverse');
  const OMNI_NODE_HASH = namehash.hash('hemi');

  const txOptions = { gasPrice: ethers.utils.parseUnits('200', 'gwei'), gasLimit: 3000000 };

  // ✅ Deploy HemiNamesRegistry
   console.log('\n1. Deploying DotLabsRegistry...')
  const Registry = await ethers.getContractFactory('DotLabsRegistry', wallet)
  const dotLabsRegistry = await Registry.deploy()
  await dotLabsRegistry.deployed()
  console.log('✅ Registry deployed to:', dotLabsRegistry.address)

  // // ✅ Deploy BaseRegistrarImplementation
  const BaseRegistrarImplementation = await ethers.getContractFactory('BaseRegistrarImplementation', wallet);
  const baseRegistrarImplementation = await BaseRegistrarImplementation.deploy(dotLabsRegistry.address, OMNI_NODE_HASH);
  await baseRegistrarImplementation.deployed();
  console.log('✅ BaseRegistrarImplementation Deployed at:', baseRegistrarImplementation.address);

  // // ✅ Deploy ReverseRegistrar
  const ReverseRegistrar = await ethers.getContractFactory('ReverseRegistrar', wallet);
  const reverseRegistrar = await ReverseRegistrar.deploy(dotLabsRegistry.address);
  await reverseRegistrar.deployed();
  console.log('✅ ReverseRegistrar Deployed at:', reverseRegistrar.address);

  // // ✅ Deploy StaticMetadataService
  const StaticMetadataService = await ethers.getContractFactory('StaticMetadataService', wallet);
  const staticMetadataService = await StaticMetadataService.deploy('ipfs://bafybeiasy6wuw4qtbnccjc62nwxfwsu3vd3gk3k3qmxcai45uygesio5hu/');
  await staticMetadataService.deployed();
  console.log('✅ StaticMetadataService Deployed at:', staticMetadataService.address);

  // ✅ Deploy StablePriceOracle
  const StablePriceOracle = await ethers.getContractFactory('StablePriceOracle', wallet);
  const stablePriceOracle = await StablePriceOracle.deploy("0xA6E7F4Ca9739B65B4dD41B9517094C022363F71e", [477000000000n, 397500000000n, 318000000000n, 238500000000n, 159000000000n]);
  await stablePriceOracle.deployed();
  console.log('✅ StablePriceOracle Deployed at:', stablePriceOracle.address);

  // ✅ Deploy ETHRegistrarController
  const ETHRegistrarController = await ethers.getContractFactory('newETHRegistrarController', wallet);
  const eTHRegistrarController = await ETHRegistrarController.deploy(
    baseRegistrarImplementation.address,
    stablePriceOracle.address,
    reverseRegistrar.address
  );
  await eTHRegistrarController.deployed();
  console.log('✅ ETHRegistrarController Deployed at:', eTHRegistrarController.address);

  // ✅ Deploy PublicResolver
  const PublicResolver = await ethers.getContractFactory('PublicResolver', wallet);
  const publicResolver = await PublicResolver.deploy(
    dotLabsRegistry.address,
    eTHRegistrarController.address,
    reverseRegistrar.address
  );
  await publicResolver.deployed();
  console.log('✅ PublicResolver Deployed at:', publicResolver.address);

  // ✅ Set Up Contract Instances
  const registryInstance = Registry.attach(dotLabsRegistry.address).connect(wallet);
  const registrarInstance = BaseRegistrarImplementation.attach(baseRegistrarImplementation.address).connect(wallet);
  const controllerInstance = ETHRegistrarController.attach(eTHRegistrarController.address).connect(wallet);
  const reverseInstance = ReverseRegistrar.attach(reverseRegistrar.address).connect(wallet);

  // ✅ Configure Contracts
  console.log("🔹 Setting Up Contracts...");
  
  const setRootNode = await registryInstance.setSubnodeOwner(ZERO_HASH, OMNI_KECCAK_HASH, baseRegistrarImplementation.address);
  await setRootNode.wait();
  console.log('✅ Set Root Node');

  const setReverseNode = await registryInstance.setSubnodeOwner(ZERO_HASH, REVERSE_KECCAK_HASH, deployer);
  await setReverseNode.wait();
  console.log('✅ Set Reverse Node');

  const setAddrNode = await registryInstance.setSubnodeOwner(REVERSE_NODE_HASH, ADDR_KECCAK_HASH, reverseRegistrar.address);
  await setAddrNode.wait();
  console.log('✅ Set Addr Node');

  const setController = await registrarInstance.addController(eTHRegistrarController.address);
  await setController.wait();
  console.log('✅ Set Controller In Registrar');

  const setControllerReverse = await reverseInstance.setController(eTHRegistrarController.address, true);
  await setControllerReverse.wait();
  console.log('✅ Set Reverse Controller In Registrar');

  const setResolverReverse = await reverseInstance.setDefaultResolver(publicResolver.address);
  await setResolverReverse.wait();
  console.log('✅ Set Default Resolver In Reverse Registrar');

  // const setPriceOracle = await controllerInstance.setPriceOracle("0x66B9CD0ce21cF2C5f22A1Fb7A10FD63E5C2C4cdf")
  // await setPriceOracle.wait()
  // console.log('✅ Set Price Oracle');

  // ✅ Register Domain
  // const registerDomain = await controllerInstance.register(
  //   'hello',
  //   deployer,
  //   3156000,
  //   { value: ethers.utils.parseEther('1') }
  // );
  // await registerDomain.wait();
  // console.log('✅ Registered Domain "hello"');

  console.log("🚀 Deployment Completed Successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment Failed:", error);
    process.exit(1);
  });