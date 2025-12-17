const hre = require('hardhat')
require('dotenv').config()
import { ethers, getNamedAccounts } from 'hardhat'
import namehash from 'eth-ens-namehash'
import { keccak256 } from 'js-sha3'

async function main() {
  const { deployer, owner } = await getNamedAccounts()

  const ZERO_HASH =
    '0x0000000000000000000000000000000000000000000000000000000000000000'
  const OMNI_KECCAK_HASH = '0x' + keccak256('zeta')
  const REVERSE_KECCAK_HASH = '0x' + keccak256('reverse')
  const ADDR_KECCAK_HASH = '0x' + keccak256('addr')

  const REVERSE_NODE_HASH = namehash.hash('reverse')
  const OMNI_NODE_HASH = namehash.hash('zeta')

  //DotLabsRegistry
  const DotLabsRegistry = await ethers.getContractFactory('DotLabsRegistry')
  const dotLabsRegistry = await DotLabsRegistry.deploy()
  await dotLabsRegistry.deployed()
  console.log('DotLabsRegistry address:', dotLabsRegistry.address)

  // Root
  // const Root = await ethers.getContractFactory('Root')
  // const root = await Root.deploy(dotLabsRegistry.address)
  // await root.deployed()
  // console.log('Root address:', root.address)

  //BaseRegistrarImplementation
  const BaseRegistrarImplementation = await ethers.getContractFactory(
    'BaseRegistrarImplementation',
  )
  const baseRegistrarImplementation = await BaseRegistrarImplementation.deploy(
    dotLabsRegistry.address,
    OMNI_NODE_HASH,
  )
  await baseRegistrarImplementation.deployed()
  console.log(
    'BaseRegistrarImplementation address:',
    baseRegistrarImplementation.address,
  )

  //ReverseRegsitrar
  const ReverseRegistrar = await ethers.getContractFactory('ReverseRegistrar')
  const reverseRegistrar = await ReverseRegistrar.deploy(
    dotLabsRegistry.address,
  )
  await reverseRegistrar.deployed()
  console.log('ReverseRegistrar address:', reverseRegistrar.address)

  // StaticMetadataService
  const StaticMetadataService = await ethers.getContractFactory(
    'StaticMetadataService',
  )
  const staticMetadataService = await StaticMetadataService.deploy(
    'ipfs://bafybeiasy6wuw4qtbnccjc62nwxfwsu3vd3gk3k3qmxcai45uygesio5hu/',
  )
  await staticMetadataService.deployed()
  console.log('StaticMetadataService address:', staticMetadataService.address)

  // StablePriceOracle
  const StablePriceOracle = await ethers.getContractFactory('StablePriceOracle')
  const stablePriceOracle = await StablePriceOracle.deploy([
    100, 200, 300, 400, 500,
  ])
  await stablePriceOracle.deployed()
  console.log('StablePriceOracles address:', stablePriceOracle.address)

  //EthREgistrarController
  const ETHRegistrarController = await ethers.getContractFactory(
    'newETHRegistrarController',
  )
  const eTHRegistrarController = await ETHRegistrarController.deploy(
    baseRegistrarImplementation.address,
    stablePriceOracle.address,
    reverseRegistrar.address
  )
  await eTHRegistrarController.deployed()
  console.log('ETHRegistrarController address:', eTHRegistrarController.address)

  // PublicResolver
  const PublicResolver = await ethers.getContractFactory('PublicResolver')
  const publicResolver = await PublicResolver.deploy(
    dotLabsRegistry.address,
    eTHRegistrarController.address,
    reverseRegistrar.address,
  )
  await publicResolver.deployed()
  console.log('Public Resolver address:', publicResolver.address)

  //Setting Up Contract Instances

  const registryInstance = await DotLabsRegistry.attach(dotLabsRegistry.address)

  const registrarInstance = await BaseRegistrarImplementation.attach(
    baseRegistrarImplementation.address,
  )

  const controllerInstance = await ETHRegistrarController.attach(
    eTHRegistrarController.address,
  )

  const reverseInstance = await ReverseRegistrar.attach(
    reverseRegistrar.address,
  )

  // Calling Functions
  const setRootNode = await registryInstance.setSubnodeOwner(
    ZERO_HASH,
    OMNI_KECCAK_HASH,
    baseRegistrarImplementation.address,
  )
  console.log('Set Root Node', setRootNode.hash)
  await setRootNode.wait()

  const setReverseNode = await registryInstance.setSubnodeOwner(
    ZERO_HASH,
    REVERSE_KECCAK_HASH,
    deployer,
  )

  await setReverseNode.wait()
  console.log('Set Reverse Node', setReverseNode.hash)

  const setAddrNode = await registryInstance.setSubnodeOwner(
    REVERSE_NODE_HASH,
    ADDR_KECCAK_HASH,
    reverseRegistrar.address,
  )
  await setAddrNode.wait()

  console.log('Set Addr Node', setAddrNode.hash)

  const setController = await registrarInstance.addController(
    eTHRegistrarController.address,
  )
  await setController.wait()

  console.log('Set Controller In Registrar', setController.hash)

  const setControllerReverse = await reverseInstance.setController(
    eTHRegistrarController.address,
    true,
  )
  await setControllerReverse.wait()

  console.log('Set Reverse Controller In Registrar', setControllerReverse.hash)

    const setResolverReverse = await reverseInstance.setDefaultResolver(
      publicResolver.address
          )
    await setResolverReverse.wait()

    console.log('Set Default Resolver In Reverse Registrar', setResolverReverse.hash)

  const registerDomain = await controllerInstance.register(
    'hello',
    owner,
    3156000,
    {
      value: ethers.utils.parseEther('1'),
    },
  )
  await registerDomain.wait()

  console.log('Register Domain', registerDomain.hash)
}
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
