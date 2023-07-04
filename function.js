const { BigNumberish, BigNumber}  = require('ethers');
const {floatToFixed}  = require('./utils');
const ethers = require('ethers');


let lookback = BigInt(3600e18);

function getTickSpacing(tickSpacing){
    return BigInt(Math.floor(Math.log(tickSpacing) / Math.log(1.0001)));
};

async function getRouter(){};

async function getFactory(){};

async function multicall(_router, _callData, _params){
    const response = await _router.multicall(_callData, _params); 
    return await response.wait();
}

async function getPool(_factory, token0, token1, _fee, _tickspacing, _lookback=1080){
    // console.log(floatToFixed(_tickspacing, 4).toString())
    const pool = await _factory.lookup(
        floatToFixed(_fee),
        floatToFixed(_tickspacing, 4),
        floatToFixed(_lookback),
        token0,
        token1
    )
    return pool
};

async function getEthBPool(_factory, _fee, amount, tokenB, _lookback=BigInt(3600e18)){
    return await getPool(
        _fee,
        BigNumber.from('weth9Address').toBigInt() < 
        BigNumber.from(tokenB).toBigInt()
        ? 'weth9'
        : tokenB,
        BigNumber.from('weth9Address').toBigInt() < 
        BigNumber.from(tokenB).toBigInt()
        ? tokenB
        : 'weth9',  // 这部分未完成，所有字符串都是需要填入wETH9的地址。
        amount,
        amount,
        _lookback
    )
};

// token之间互相交易，失败
async function swapTokenToToken(_router, _tokenIn, _tokenOut, _pool, _amount, _wallet){
    let callData = [
        _router.interface.encodeFunctionData('exactInputSingle',[
            [
            _tokenIn,
            _tokenOut,
            _pool,
            _wallet.address,
            1e13,
            _amount,
            0,
            floatToFixed(0)   
            ],
        ]),
    ];
    const params = {  
        gasLimit: 10000, // 自定义 gasLimit
        gasPrice: ethers.utils.parseUnits('0.6', 'gwei'), // 自定义 gasPrice
    } 
    
    return await multicall(_router, callData, params);
    // return await _router.multicall(callData)
};

// 从原生ETH换成其它币。
async function swapEthToToken(_router, _tokenIn, _tokenOut, _pool, _amount, _wallet){
    let callData = [
        _router.interface.encodeFunctionData('exactInputSingle',[
            [
            _tokenIn,
            _tokenOut,
            _pool,
            _wallet.address,
            1e13,
            _amount,
            0,
            floatToFixed(0)   
            ],
        ]),
    ];
    const params = {value: _amount} 
    
    return await multicall(_router, callData, params);
};

async function swapTokenToETH(_router, _tokenIn, _tokenOut, _pool, _amount, _wallet){
    let callData = [
        _router.interface.encodeFunctionData('exactInputSingle',[
            [
            _tokenIn,
            _tokenOut,
            _pool,
            '0x0000000000000000000000000000000000000000',
            1e13,
            _amount,
            0,
            0   
            ],
        ]),
    ];
    callData.push(
        _router.interface.encodeFunctionData("unwrapWETH9", [
          floatToFixed(0),
          _wallet.address,
        ])
      );
    return await _router.multicall(callData)
};

module.exports = {swapEthToToken, swapTokenToETH,swapTokenToToken};
