// SPDX-License-Identifier: UNLICENSED
const hre = require('hardhat')
require('dotenv').config()
import { ethers } from 'hardhat'

async function main() {
  // //NameWrapper
  // const NameWrapper = await ethers.getContractFactory('NameWrapper')

  // const nameWrapper = await NameWrapper.deploy(
  //   '0x6E799103cb64FC75c6DbEaE0D0393e9CA142155e',
  //   '0x484B8B3c466f27Cd33f33eB8876F9901f494398D',
  //   '0xc7032B34Ed6214261F23c83E2Fc8337273bB67A5',
  // )

  // await nameWrapper.deployed()

  // console.log('NameWrapper address:', nameWrapper.address)

  const NewContract = await ethers.getContractFactory(
    'newETHRegistrarController',
  )
  const newContract = await NewContract.deploy(
    '0x484B8B3c466f27Cd33f33eB8876F9901f494398D',
    '0xd2e887c758975e15937df3ABa30360565b01Ed1C',
  )
  await newContract.deployed()
  console.log(`New Eth registrar deployed at address ${newContract.address}`)
}

// Call the main function and catch if there is any error
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
