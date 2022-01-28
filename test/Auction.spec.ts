/* eslint-disable prettier/prettier */
import { expect } from 'chai'
import { Contract, Event } from 'ethers'

import { ethers } from 'hardhat'
import '@nomiclabs/hardhat-ethers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import {
  createAuctionWithDefaults,
} from './utilities'

describe('Auction', async () => {
  let owner: SignerWithAddress
  let auction: Contract
  let biddingToken: Contract
  let collateralLockerFactory: Contract
  beforeEach(async () => {
    ;[owner] = await ethers.getSigners()

    const CollateralLockerFactory = await ethers.getContractFactory('CollateralLockerFactory')
    collateralLockerFactory = await CollateralLockerFactory.deploy()

    const Auction = await ethers.getContractFactory('Auction')
    auction = await Auction.deploy(collateralLockerFactory.address)

    const BiddingToken = await ethers.getContractFactory('QaraghandyToken')
    biddingToken = await BiddingToken.deploy(
      'BiddingToken',
      'BT',
      ethers.utils.parseEther('100'),
    )
  })
  describe('Auction', async () => {
    it('should create an auction and assign it an ID', async () => {
      // setup
      const assetAddress = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
      const tx = await collateralLockerFactory.newLocker(assetAddress);
      const receipt = await tx.wait();
      const lockerAddress = receipt.events.find(
        (event: Event) => event.event === 'CollateralLockerCreated'
      ).args.collateralLocker;

      const {
        auctionId,
        auctioningTokenAddress,
      } = await createAuctionWithDefaults(biddingToken, auction, lockerAddress)

      // assert
      const auctionData = await auction.auctionData(auctionId)
      expect(auctionData.auctioningToken).to.equal(auctioningTokenAddress)
      expect(auctionData.biddingToken).to.equal(biddingToken.address)
      expect(await auction.auctionCount()).to.eq(1)
    })
  })
})
