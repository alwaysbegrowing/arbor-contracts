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
  let easyAuction: Contract
  beforeEach(async () => {
    ;[owner] = await ethers.getSigners()

    const EasyAuction = await ethers.getContractFactory('EasyAuction')
    easyAuction = await EasyAuction.deploy()

    const Auction = await ethers.getContractFactory('Auction')
    auction = await Auction.deploy(easyAuction.address)

    const BiddingToken = await ethers.getContractFactory('QaraghandyToken')
    biddingToken = await BiddingToken.deploy(
      'BiddingToken',
      'BT',
      ethers.utils.parseEther('100'),
    )
  })
  describe('BiddingToken', async () => {
    it('Should mint coins and transfer to auction address', async () => {
      // act
      await biddingToken
        .connect(owner)
        .transfer(auction.address, ethers.utils.parseEther('10'))

      // assert
      expect(await biddingToken.connect(owner).balanceOf(owner.address)).to.eq(
        ethers.utils.parseEther('90'),
      )
      expect(await biddingToken.balanceOf(auction.address)).to.eq(
        ethers.utils.parseEther('10'),
      )
    })
  })
  describe('Auction', async () => {
    it('Should deploy tokens to a new address', async () => {
      // act
      const tx = await auction.deployUniqueToken(
        '1',
        ethers.utils.parseEther('10'),
      )
      const receipt = await tx.wait()

      const tokenAddress = receipt.events.find(
        (e: Event) => e.event === 'TokenDeployed',
      ).args.tokenAddress

      // assert
      expect(tokenAddress).to.not.eq(ethers.constants.AddressZero)
    })
    it('should create an auction and assign it an ID', async () => {
      // setup
      const {
        auctionId,
        auctioningTokenAddress,
      } = await createAuctionWithDefaults(biddingToken, auction)

      // assert
      const auctionData = await easyAuction.auctionData(auctionId)
      expect(auctionData.auctioningToken).to.equal(auctioningTokenAddress)
      expect(auctionData.biddingToken).to.equal(biddingToken.address)
      expect(await auction.auctionCount()).to.eq(1)
    })
  })
})
