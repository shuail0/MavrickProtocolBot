const { Wallet, Provider } = require('zksync-web3');
const zksync = require('zksync-web3');
const ethers = require('ethers');
const { defaultAbiCoder } = require('ethers').utils;
const { BigNumber } = require('ethers');
const { approveToken } = require('./erc20utils');
const fs = require('fs');
const { convertCSVToObjectSync, sleep, getRandomFloat, saveLog, getConfig } = require('./utils');
const {swapEthToToken, swapTokenToETH, swapTokenToToken} = require('./function');

const [baseConfig, RPC, tokenAddress, contractAddress] = getConfig();
let maxDeadline = 1e13;
// ------------配置RPC-----------
const provider = new Provider(RPC.zks);
const ethereumProvider = new ethers.getDefaultProvider(RPC.eth);
// -----------------------------------------
// const floatToFixed = (num, decimals = 18) => {
//     return BigNumber.from(ethers.utils.parseUnits(num.toString(), decimals));
//   };

// 程序开始运行
console.log('正在打开钱包文件...')
//  打开地址文件
const walletData = convertCSVToObjectSync(baseConfig.walletPath);
let gasPrice;
async function main() {
    
    console.log('开始循环...')
    for(wt of walletData){

        // 循环获取GAS
        while (true) {
            console.log('开始获取当前主网GAS');
            gasPrice = parseFloat(ethers.utils.formatUnits(await ethereumProvider.getGasPrice(), 'gwei'));
            console.log(`当前gasPrice：${gasPrice}`);
            if (gasPrice > baseConfig.maxGasPrice) {
                console.log(`gasPrice高于设定的最大值${baseConfig.maxGasPrice}，程序暂停30分钟`)
                await sleep(30);
            } else {
                console.log(`gasPrice低于${baseConfig.maxGasPrice}，程序继续执行`) 
                break;
            };
        }


        try {

//             // 创建钱包
            const wallet = new Wallet(wt.PrivateKey, provider, ethereumProvider);
            console.log(`帐号：${wt.Wallet}, 地址：${wallet.address}， 开始执行操作...`);
            console.log('开始查询账户ETH余额.')
            const ethBalance = parseFloat(ethers.utils.formatEther(await wallet.getBalance(tokenAddress.ETH_ADDRESS)));
            console.log(`成功查询账户ETH余额，余额：${ethBalance}`);
            
            // 设定随机交易金额
            const minAmount = ethBalance * baseConfig.minAmountPct;
            const maxAmount = ethBalance * baseConfig.maxAmountPct;
            const randomAmount = getRandomFloat(minAmount, maxAmount).toFixed(16);
            const tradingamount = ethers.utils.parseEther(randomAmount.toString());

            // 创建router合约
            const routerABI = JSON.parse(fs.readFileSync('./ABI/MaverickIRouter.json'));
            const classicRouter = new ethers.Contract(contractAddress.Router, routerABI, wallet);

            // 将ETH换成USDC
            console.log('开始将ETH兑换为USDC，兑换数量：', tradingamount)
            await swapEthToToken(classicRouter, tokenAddress.wETH9Address, tokenAddress.usdcAddress, '0x57681331B6cB8Df134dccb4B54dC30e8FcDF0Ad8', tradingamount, wallet);

            // 查询USDC余额
            console.log('开始查询余额。。。')
            const tokenBalance = await provider.getBalance(wallet.address, "latest", tokenAddress.usdcAddress);
            console.log('tokenBalance', tokenBalance.toString());

            // // 授权USDC
            console.log('开始授权。。。')
            const txReceipt = await approveToken(wallet, tokenAddress.usdcAddress, contractAddress.Router, tokenBalance)

            console.log('将USDC兑换为ETH')
            const tx = await swapTokenToETH(classicRouter, tokenAddress.usdcAddress, tokenAddress.wETH9Address, '0x57681331B6cB8Df134dccb4B54dC30e8FcDF0Ad8', tokenBalance, wallet);
            // 保存日志
            const currentTime = new Date().toISOString();
            const logMessage = `成功执行 - 时间: ${currentTime}, 钱包名称: ${wt.Wallet},钱包地址: ${wt.Address}`;
            saveLog(`${CONFIG.baseconfig.projectName}Sucess`, logMessage);
            // 暂停
            const sleepTime = getRandomFloat(CONFIG.baseconfig.minSleepTime, CONFIG.baseconfig.maxSleepTime).toFixed(1); 
            console.log(logMessage, '程序暂停',sleepTime,'分钟后继续执行');
            await sleep(sleepTime);
        } catch (error) {
            // 保存错误日志
            const currentTime = new Date().toISOString();
            const logMessage = `失败 - 时间: ${currentTime}, 钱包名称: ${wt.Wallet},钱包地址: ${wt.Address},错误信息: ${error}`;
            saveLog(`${CONFIG.baseconfig.projectName}Error`, logMessage);
            console.log('程序出现错误，暂停30分钟后继续执行。');
            await sleep(30);
        }
    }
}

main()
