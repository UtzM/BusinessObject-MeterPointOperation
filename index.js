#!/usr/bin/env node

const vorpal = require('vorpal')();
var srequest = require('sync-request');
const fs = require('fs');
const vm = require('vm');

const Hapi = require('hapi');
var opener     = require('opener');

global.smart_contract_stromkonto="0x19BF166624F485f191d82900a5B7bc22Be569895";

/* StromDAO Business Object: MeterPoint Operation
 * =========================================
 * Meter Point Operator handling for StromDAO Energy Blockchain.
 * 
 * @author Thorsten Zoerner thorsten.zoerner@stromdao.de 
 * 
 * Usage: 
 *    stromdao-mp store YOUR_METERPOINT_ID READING
 *    stromdao-mp retrieve YOUR_METERPOINT_ID
 * 
 * This script will automatically assign a unique energy blockchain address for 
 * your meterpoint. 
 * 
 * If used in StromDAO-BO's MAIN BRANCH this will be defaulted to the testnet environment.
 * 
 */

require('dotenv').config();
 
var StromDAOBO = require("stromdao-businessobject");    

function errorHandler(error) {
	console.log("Error",error);	
}
function ensureAllowedTx(extid) {	
	var p1 = new Promise(function(resolve, reject) {
		var node = new StromDAOBO.Node({external_id:extid,testMode:true,rpc:global.rpcprovider});
		var sender=node.wallet.address;
		
		var node = new StromDAOBO.Node({external_id:"stromdao-mp",testMode:true,rpc:global.rpcprovider});	  
		var managed_meters= node.storage.getItemSync("managed_meters");
		try
		{
		if(managed_meters==null) managed_meters=[]; else managed_meters=JSON.parse(managed_meters);
		
		if(node.storage.getItemSync("managed_"+extid)==null) {
				managed_meters.push(extid);
				node.storage.setItemSync("managed_meters",JSON.stringify(managed_meters));	
				node.storage.setItemSync("managed_"+extid,sender);	
				node.stromkontoproxy(global.smart_contract_stromkonto).then(function(skop) {
						skop.modifySender(sender,true).then(function(tx) {
								vorpal.log("Mandated ",extid,tx);	
								resolve("mandated");						
						});
				}).catch(function(e) {vorpal.log("not mandated");resolve("-");});			

		} else {
			resolve("mandated");	
		}
		} catch(e) {
				resolve("-");
		}
	});
	return p1;
}



function cmd_tokenize(args, callback,tkn) {	
	vorpal.log("Meter Point Token",tkn);
	if(typeof args.options.transfer != "undefined") {
		if(args.options.transfer.length!=42) {
			var node = new StromDAOBO.Node({external_id:args.options.transfer,testMode:true,rpc:global.rpcprovider});	
			args.options.transfer=node.wallet.address;
		}		
	}
	var node = new StromDAOBO.Node({external_id:args.meter_point_id,testMode:true,rpc:global.rpcprovider});	
	node.mptoken(tkn).then(function(t) {
			t.issue().then(function(tx) {
					t.power_token().then(function(pt) {
						node.erc20token(pt).then(function(token) {
							token.balanceOf(node.wallet.address).then(function(bal) {
								vorpal.log("MP Power Tokens",bal);
								if((typeof args.options.transfer != "undefined")&&(typeof args.options.amount != "undefined")) {
									token.transfer(args.options.transfer,args.options.amount).then(function(tx) {
											vorpal.log("Transfer to ",args.options.transfer," Tokens ",args.options.amount,tx);
											callback();
									})
								} else
								if(typeof args.options.balance != "undefined") {
									token.balanceOf(args.options.balance).then(function(bal2) {
											vorpal.log("Balance of ",args.options.balance,bal2);
											callback();
									})
								} else
								callback();				
							});	
						});					
					});					
			});
	});	
}

function cmd_cutokenize(args, callback,tkn) {	
	vorpal.log("CU Token",tkn);
	if(typeof args.options.transfer != "undefined") {
		if(args.options.transfer.length!=42) {
			var node = new StromDAOBO.Node({external_id:args.options.transfer,testMode:true,rpc:global.rpcprovider});	
			args.options.transfer=node.wallet.address;
		}		
	}
	var node = new StromDAOBO.Node({external_id:args.meter_point_id,testMode:true,rpc:global.rpcprovider});	
	node.cutoken(tkn).then(function(t) {			
					t.totalSupply().then(function(ts) {
						vorpal.log("Total Issued",ts);
						if(typeof args.options.add != "undefined") {
							t.addMeterpoint(args.options.add).then(function(bal2) {
									vorpal.log("Added ",args.options.add,bal2);
									var node = new StromDAOBO.Node({external_id:args.options.add,testMode:true,rpc:global.rpcprovider});
									node.roleLookup().then(function(rl) {
										rl.setRelation(45,tkn).then(function(o) {	
											vorpal.log("Assigned");
											callback();	
										});
									});
							})
						} else	
						if(typeof args.options.balance != "undefined") {
							t.balanceOf(args.options.balance).then(function(bal2) {
									vorpal.log("Balance of ",args.options.balance,bal2);
									callback();
							})
						} else	
						if(typeof args.options.issue != "undefined") {
							// Only issue if newer Readings !CONSENS!
							t.obj.source().then(function(o) {
								console.log("MPDelta ",o[0]);
								node.mpdelta(o[0]).then(function(mpdelta) {									
									mpdelta.lastReadingTime().then(function(lrt) {
										var token_lrt=lrt[0].toString();
												t.issue().then(function(tx) {
													vorpal.log("Issued ",tx);
													callback();
												});
												
										
									});
								}).catch(function(e) {console.log("ER",e);});
							});
							
						} else {									
							t.balanceOf(node.wallet.address).then(function(bal) {
									vorpal.log("Self Holds",bal);								
									callback();										
							});					
						}
					});													
	});	
}

function cmd_set(args, callback,tkn) {	
	vorpal.log("Set",tkn);
	
	if(typeof args.options.add != "undefined") {
		if(args.options.add.length!=42) {
			var node = new StromDAOBO.Node({external_id:args.options.add,testMode:true,rpc:global.rpcprovider});
			args.options.add=node.wallet.address;
		}		
		var node = new StromDAOBO.Node({external_id:args.meter_point_id,testMode:true,rpc:global.rpcprovider});		
		node.mpset(tkn).then(function(mpset) {
				
				mpset.addMeterPoint(args.options.add).then(function(tx) {
						vorpal.log("Added",tx.hash);
						callback();
				});
		});
	} else
	if(typeof args.options.assign != "undefined") {
		if(args.options.assign.length!=42) {
			var node = new StromDAOBO.Node({external_id:args.options.assign,testMode:true,rpc:global.rpcprovider});
			args.options.assign=node.wallet.address;
		}
		var node = new StromDAOBO.Node({external_id:args.meter_point_id,testMode:true,rpc:global.rpcprovider});
		node.roleLookup().then(function(rl) {
			rl.relations(args.options.assign,44).then(function(tx) {
				rl.setRelation(44,tx).then(function(o) {
					vorpal.log(o);								
					callback();
				});
			});
		});
	} else
	if(typeof args.options.list != "undefined") {
		var node = new StromDAOBO.Node({external_id:args.meter_point_id,testMode:true,rpc:global.rpcprovider});
		node.mpset(tkn).then(function(mpset) {		
						var mps=[];
				
						var j=10;
						for(var i=0;i<j;i++) {
							mps.push(new Promise(function(res3,rej3) {							
							mpset.meterpoints(i).then(function(mp) {
								res3(mp);
							}).catch(function(e) {res3();});									
						}));
						}
						
						Promise.all(mps).then(function(values) {
							var mps=[];
							for(var i=0;i<values.length;i++) {
								if(typeof values[i] != "undefined") {
									mps.push(values[i]);
								}						
							}
							vorpal.log(mps);
							callback();
						});
				
		});
	} else { callback(); }
}


function ensureCUToken(args,callback) {	
	var node = new StromDAOBO.Node({external_id:args.meter_point_id,testMode:true,rpc:global.rpcprovider});	
	
	node.roleLookup().then(function(rl) {
			var tk="0x0000000000000000000000000000000000000000";			
			rl.relations(node.wallet.address,45).then(function(tx) {								
				if(tx!="0x0000000000000000000000000000000000000000") {				
					cmd_cutokenize(args,callback,tx);
				} else {																		
					
					node.cutokenfactory("0xf0AF273DA2aBdFac56B3760F527d4Dd515968bab").then( function(ssf) {													
							ssf.build("0x0000000000000000000000000000000000000008",node.wallet.address).then( function(tx_result) {													
							vorpal.log("New CUToken",tx_result);
							rl.setRelation(45,tx_result).then(function(o) {								
								cmd_cutokenize(args,callback,tx_result);	
							});
						});
					});						
				}
			});
	});	
}

function ensureToken(args,callback) {
	var node = new StromDAOBO.Node({external_id:args.meter_point_id,testMode:true,rpc:global.rpcprovider});	
	node.roleLookup().then(function(rl) {
			var tk="0x0000000000000000000000000000000000000000";			
			rl.relations(node.wallet.address,43).then(function(tx) {			
				if(tx!="0x0000000000000000000000000000000000000000") {				
					cmd_tokenize(args,callback,tx);
				} else {									
					node.mptokenfactory().then(function(mptf) {
						mptf.build("0x0000000000000000000000000000000000000008",node.wallet.address).then(function(tx) {						
							vorpal.log("New MPToken",tx);
							rl.setRelation(43,tx).then(function(o) {								
								cmd_tokenize(args,callback,tx);	
							});
						});
					});						
				}
			});
	});	
}

function ensureSet(args,callback) {
	var node = new StromDAOBO.Node({external_id:args.meter_point_id,testMode:true,rpc:global.rpcprovider});	
	node.roleLookup().then(function(rl) {
			var tk="0x0000000000000000000000000000000000000000";			
			rl.relations(node.wallet.address,44).then(function(tx) {			
				if((tx!="0x0000000000000000000000000000000000000000")&&(typeof args.options.reset == "undefined")) {				
					cmd_set(args,callback,tx);
				} else {									
					node.mpsetfactory().then(function(mptf) {
						mptf.build("0x0000000000000000000000000000000000000008",node.wallet.address).then(function(tx) {						
							vorpal.log("New Set",tx);
							rl.setRelation(44,tx).then(function(o) {								
								cmd_set(args,callback,tx);	
							});
						});
					});						
				}
			});
	});	
}

function cmd_store(args, callback) {	
	ensureAllowedTx(args.meter_point_id).then(function(d) { 	
		if(args.reading==null) {
			var node = new StromDAOBO.Node({external_id:args.meter_point_id,testMode:true,rpc:global.rpcprovider});	
			var token=node.storage.getItemSync("dgy_token");
			var alias=node.storage.getItemSync("dgy_alias");
			if(token==null) { 
					vorpal.log("ERROR: If no reading is specified a valid Discovergy API login needs to be available. HINT: Use discovergy to login");
					callback();
					return;
			}			
			var Discovergy = require("stromdao-bo-discovergy");		
			var dgy = new Discovergy("dgy_token",node);	
			dgy.getMeterReading(alias, function(o) {	
						var values = o.values;
						if(typeof values !="undefined") {
							var energy = ""+values.energy+"";
							energy=energy.substr(0,energy.length-7);
							args.reading=energy;
							cmd_store(args,callback);
						} else {
							vorpal.log("DGY Error",o);
							callback();
						}
			});
			return;
		} else {
		args.reading=Math.round(args.reading);	
		}
		var node = new StromDAOBO.Node({external_id:args.meter_point_id,testMode:true,rpc:global.rpcprovider});	
		node.storage.setItemSync(node.wallet.address,args.meter_point_id);
		node.mpr().then( function(mpo) {
				global.settlement={};
				global.node=node;
				var settlement_js="";
				var BpGross=0;
				var UpGross=0;
				var cost=0;
				if(typeof args.options.auto != "undefined") {
						args.options.a="Qmd4x6bFWqRAq94o8ozeG2yJarLedKBPULzpgL91B67tEX";
						args.options.de=args.options.auto;	
				}
				if(typeof args.options.a != "undefined") {
					settlement_js = srequest('GET',"https://fury.network/ipfs/"+args.options.a+"").body.toString();				
				}
				if(typeof args.options.f != "undefined") {
					settlement_js = fs.readFileSync( args.options.f);
				}

				if(typeof args.options.de != "undefined") {
					try {
						settlement.tarif = JSON.parse(srequest('GET',"https://fury.network/tarifs/de/"+args.options.de+"").body.toString());	
						node.storage.setItemSync("tarif_"+args.options.de,JSON.stringify(settlement.tarif));
					} catch(e) {
						if(node.storage.setItemSync("tarif_"+args.options.de)!=null) {
							settlement.tarif=JSON.parse(node.storage.setItemSync("tarif_"+args.options.de));	
						}
					}
				
					for (var k in settlement.tarif){
						if (settlement.tarif.hasOwnProperty(k)) {		
							BpGross	=settlement.tarif[k].BpGross*10000000;
							UpGross=settlement.tarif[k].UpGross*100000;		
							settlement.zipcode=settlement.tarif[k].Zipcode;
						}
					}	
					settlement.BpGross=BpGross;
					settlement.UpGross=UpGross;		
					
					
				}
				settlement.account=node.wallet.address;
				settlement.node_account=global.blk_address;
				settlement.node_wallet=node.nodeWallet.address;
				if(typeof args.options.credit != "undefined") {
					args.options.workprice=args.options.workprice*(-1);
				}
				if(typeof args.options.workprice != "undefined") {
						var to=settlement.node_account;
						var from=settlement.account;
						if(args.options.workprice<0)  { from=settlement.node_account; to=settlement.account; } 
						settlement_js="global.promise = new Promise(function(resolve2,reject2) { node.stromkontoproxy(global.smart_contract_stromkonto).then(function(sko) { sko.addTx('"+from+"','"+to+"',Math.abs(Math.round("+args.options.workprice+"*(settlement.base/1000))),settlement.base).then(function(tx) {	console.log('AddTx','"+from+"','"+to+"',Math.abs(Math.round("+args.options.workprice+"*(settlement.base/1000))),settlement.base,tx); resolve2(tx);});});});";							
				}
				mpo.readings(node.wallet.address).then( function(start_reading) {
					settlement.start=start_reading;		
					if(start_reading.power>args.reading) {
							vorpal.log("ERROR: Negative settlement requested",start_reading.power,args.reading);
							callback();
							return;
					}									
					mpo.storeReading(args.reading).then( function(tx_result) {	
						try {
							if((settlement_js.length>0)&&(settlement.start.power>0)) {
								mpo.readings(node.wallet.address).then( function(end_reading) {
									settlement.end=end_reading;
									var cost=0;
									var kwh=(settlement.end.power-settlement.start.power)/1000;
									cost+=Math.round(kwh*UpGross);
									
									var time=(settlement.end.time-settlement.start.time)/(365*86400);
									cost+=Math.round(time*BpGross);
									settlement.cost=cost;
									settlement.base=(settlement.end.power.toString()*1-settlement.start.power.toString()*1);
									
									//Added to ensure PK is not required for settlement
									var node = new StromDAOBO.Node({external_id:"stromdao-mp",testMode:true,rpc:global.rpcprovider});	  	
									var script = new vm.Script(settlement_js);
									var result=script.runInThisContext();	
									if(typeof global.promise!="undefined") { 
											global.promise.then(function(tx) {												
												if(typeof args.options.bx != "undefined") {
														vorpal.exec('balancing -x '+args.meter_point_id,callback);
												} else
												callback();		
											});
									} else {
											if(typeof args.options.bx != "undefined") {
														vorpal.exec('balancing -x '+args.meter_point_id,callback);
											} else
											callback();
									}												
								}).catch(function(err) {
										vorpal.log("ERROR Captured in Settlement",err);
										mpo.storeReading(start_reading.power).then( function(tx_result) {	
											callback();
										});
								});
							} else {
								vorpal.log("TX:",tx_result);																	
								callback();
							}
						} catch(err) {
								vorpal.log("ERROR Captured",err);
								mpo.storeReading(start_reading.power).then( function(tx_result) {	
									callback();
								});
						}
					});
					
				});
		});
	}).catch(function(e) { vorpal.log("Retry",e); cmd_store(args, callback);});	
}	


	
vorpal
  .command('store <meter_point_id> [reading]')    
  .description("Stores Meter Point Reading for given external Meter Point ID.") 
  .option('-a <ipfs_hash>','Apply settlement/clearing from IPFS Hash')
  .option('-f <file>','Apply settlement/clearing from file')
  .option('--bx','Performs cross balancing after commit (eq. to balancing -x command)')
  .option('--de <zipcode>','Add tarif for zipcode (Germany)')
  .option('--auto <zipcode>','Auto settle to dev/testing ledger (only Germany)')
  .option('--workprice <priceperkwh>','Defines a workprice for settlement (or earning if negative)')
  .option('--credit','Defines a workprice to be credit')
  .action(cmd_store);	

function cmd_retrieve(args, callback) {	 
	ensureAllowedTx(args.meter_point_id).then(function(d) {
		var node = new StromDAOBO.Node({external_id:args.meter_point_id,testMode:true,rpc:global.rpcprovider});	
		node.storage.setItemSync(node.wallet.address,args.meter_point_id);
		node.mpr().then( function(mpo) {
				mpo.readings(node.wallet.address).then( function(tx_result) {								
					vorpal.log("Time:",new Date(tx_result.time.toString()*1000).toLocaleString());
					vorpal.log("Reading:",tx_result.power.toString());
					tx_result.power = tx_result.power.toString();
					tx_result.time=tx_result.time.toString();
					callback(tx_result);									
				});			
		});	
	});
}

function delegates_balancing(args,callback,sko,node) {
	vorpal.log("Balancing Group",sko);
	if(typeof args.options.allow != "undefined") {			
		node.stromkontoproxy(sko).then(function(skp) {
			skp.modifySender(args.options.allow,true).then(function(tx) {
				vorpal.log("TX",tx);	
				callback();
			});
		});
	} else
	if(typeof args.options.disallow != "undefined") {
		node.stromkontoproxy(sko).then(function(skp) {
			skp.modifySender(args.options.allow,false).then(function(tx) {
				vorpal.log("TX",tx);	
				callback();
			});
		});
	} else
	if(typeof args.options.rawtx != "undefined") {
		var tx=args.options.rawtx.split(",");
		if(tx.length<4) {
				vorpal.log("ERROR: Wrong transaction format");
				callback();
		} else {			
			node.stromkonto(sko).then(function(skp) {					
				skp.balancesSoll(tx[0]).then(function(soll) {
						vorpal.log("Pre Soll",tx[0],soll);
						skp.addTx(tx[0],tx[1],tx[2],tx[3]).then(function(rx) {
							vorpal.log("TX",rx);	
							skp.balancesSoll(tx[0]).then(function(soll) {
								vorpal.log("Post Soll",tx[0],soll);
								callback();
							}).catch(function(e) {
								vorpal.log("ERROR2",e);
								callback();
							});							
						}).catch(function(e) {
								vorpal.log("ERROR",e);
								callback();
						});	
						
				});
				
			});		
		}
	} else
	if(typeof args.options.x != "undefined") {
		blk=blk_address;
		if(typeof args.options.xa != "undefined") {
			blk=args.options.xa;
		}
		node.stromkonto(smart_contract_stromkonto).then(function(skp) {
			skp.balancesHaben(node.wallet.address).then(function(parent_haben) {
				if(parent_haben.toString().indexOf(".")>0) parent_haben=0;
				skp.balancesSoll(node.wallet.address).then(function(parent_soll) {				
					if(parent_soll.toString().indexOf(".")>0) parent_soll=0;
					node.stromkonto(sko).then(function(skp) {
						skp.balancesHaben(blk).then(function(child_haben) {
							if(child_haben.toString().indexOf(".")>0) child_haben=0;
							skp.balancesSoll(blk).then(function(child_soll) {
								if(child_soll.toString().indexOf(".")>0) child_soll=0;
			
			skp.baseHaben(node.wallet.address).then(function(parent_base_haben) {				

				if(parent_base_haben.toString().indexOf(".")>0) parent_base_haben=0;
				skp.baseSoll(node.wallet.address).then(function(parent_base_soll) {	
		
					if(parent_base_soll.toString().indexOf(".")>0) parent_base_soll=0;
					node.stromkonto(smart_contract_stromkonto).then(function(skp) {
						skp.baseHaben(blk).then(function(child_base_haben) {
							if(child_base_haben.toString().indexOf(".")>0) child_base_haben=0;
							skp.baseSoll(blk).then(function(child_base_soll) {

								if(child_base_soll.toString().indexOf(".")>0) child_base_soll=0;

								var parent = (parent_haben-parent_soll)*(-1);
								var child = child_haben-child_soll;		
														
								var child_base = (parent_base_haben-parent_base_soll)*(-1);
								var parent_base = child_base_haben-child_base_soll;
										
								if((parent!=child)||(parent_base!=child_base)) {
									node.stromkonto(sko).then(function(skp) {
										vorpal.log("X balance",parent-child,"/",parent_base-child_base);	
										
										var saldo=parent-child;
										var saldo_base=parent_base-child_base;
										
										if(((saldo<0)&&(saldo_base>0))||((saldo>0)&&(saldo_base<0))) {
											saldo_base=0;											
										}
										if((parent-child<0)||((parent_base-child_base<0)&&(parent-child==0))){
												skp.addTx(global.blk,node.wallet.address,""+Math.abs(saldo),""+Math.abs(saldo_base)).then(function(tx) {
													vorpal.log("TX",tx);	
													if(typeof callback!="undefined") callback();
												}).catch(function(e) {vorpal.log("ERROR",e);});
											} else {
												skp.addTx(node.wallet.address,global.blk,""+Math.abs(saldo),""+Math.abs(saldo_base)).then(function(tx) {
													vorpal.log("TX",tx);	
													if(typeof callback!="undefined") callback();
												}).catch(function(e) {vorpal.log("ERROR",e);});
											}				
									});				
								} else {
									if(typeof callback!="undefined") callback();
								}
								
							});
						});
					});
				});
			});
								
							});
						});
					});
				});
			});
		});
	} else {
		callback();	
	}
}

function ensure_balancing(args,callback,callback2) {
	var node = new StromDAOBO.Node({external_id:args.meter_point_id,testMode:true,rpc:global.rpcprovider});	  
	node.roleLookup().then(function(rl) {
			rl.relations(node.wallet.address,42).then(function(tx) {				
				if(typeof args.options.b != "undefined") {
					rl.setRelation(42,global.smart_contract_stromkonto).then(function(sr) {
						callback2(args,callback,global.smart_contract_stromkonto,node);																							
					});
				} else {
					if(tx=="0x0000000000000000000000000000000000000000") {
						node.stromkontoproxyfactory().then(function(skof) {
								skof.build().then(function(sko) {
										rl.setRelation(42,sko).then(function(sr) {
												callback2(args,callback,sko,node);											
												
										});
								});
						});
					} else {
						callback2(args,callback,tx,node);			
					}		
				}		
			});
		}).catch(errorHandler);		
}

function cmd_balancing(args, callback) {
		ensure_balancing(args,callback,delegates_balancing);
}		
 
vorpal
  .command('retrieve <meter_point_id>')    
  .description("Retrieves Meter Point Reading for given external Meter Point ID.") 
  .action(cmd_retrieve);
  
vorpal
  .command('account <meter_point_id>')    
  .description("Get Address an keys for given external Meter Point ID.") 
  .option('--import <privateKey>','Import private Key as Meter Point. Add PKI infront of key!')
  .option('--name <SpeakingName>','Set a Name associated with BC address')
  .option('--pk','Prints Private Key of given account')
  .action(function (args, callback) {	 
	var node={};
	if(typeof args.options.import != "undefined") {
		console.log(args.options.import);
		node = new StromDAOBO.Node({external_id:args.meter_point_id,privateKey:args.options.import.substr(3),testMode:true,rpc:global.rpcprovider});	
	} else {
		node = new StromDAOBO.Node({external_id:args.meter_point_id,testMode:true});	
	}
	if(typeof args.options.name != "undefined") {
		node = new StromDAOBO.Node({external_id:args.meter_point_id,testMode:true});	
		node.roleLookup().then(function(rl) {
				rl.setName(args.options.name).then(function() {
						vorpal.log("Name set");
						callback();
				})
		});
	} else 
	if(typeof args.options.pk != "undefined") {
		node = new StromDAOBO.Node({external_id:args.meter_point_id,testMode:true});	
		vorpal.log(node.wallet.privateKey);
		callback();
	} else
	{
		vorpal.log("MPID",args.meter_point_id);
		vorpal.log("Address",node.wallet.address);
		vorpal.log("Node",node.nodeWallet.address);
		vorpal.log("BLK",global.blk_address);
		vorpal.log("Private Key","PKI",node.wallet.privateKey);
		vorpal.log("RSA Public Key",node.RSAPublicKey);
		vorpal.log("RSA Private Key",node.RSAPrivateKey);
		callback();
	}
});
vorpal
  .command('credit <meter_point_id> <amount>')    
  .description("Add credit to Meter Point ledger.") 
  .action(function (args, callback) {	 
	var node = new StromDAOBO.Node({external_id:args.meter_point_id,testMode:true,rpc:global.rpcprovider});	
	var creditor=node.wallet.address;
	var node = new StromDAOBO.Node({external_id:"stromdao-mp",testMode:true,rpc:global.rpcprovider});	  
	node.storage.setItemSync(creditor,args.meter_point_id);	
	node.stromkontoproxy(smart_contract_stromkonto).then(function(sko) {				
		sko.addTx(global.blk_address,creditor,Math.abs(args.amount),0).then(function(tx) {
			vorpal.log(tx);
			callback();
		});
	});
});	

vorpal
  .command('receipts <filename>')    
  .description("Exports transaction receipts as indexed json") 
  .action(function (args, callback) {	
	var storage = require("node-persist");
	var fs = require("fs");
	storage.initSync();
	values=storage.keys();
	var tmp = {};
	
	for (var k in values){
		if (values.hasOwnProperty(k)) {			
			if(values[k].length==66) {				
				tmp[""+values[k]]=storage.getItemSync(""+values[k]);	
				
			}
		}
	}	
	fs.writeFile(args.filename, JSON.stringify(tmp), 'utf8', function() {callback(); });		
});	


vorpal
  .command('balancing <meter_point_id>')    
  .description("(Sub) Balance Group")
  .option('--allow <mandate>', 'Allow address to book on group (add mandate)')
  .option('--disallow <mandate>', 'Disallow address to book on group (remove mandate)')
  .option('--rawtx <tx>','Performs raw transaction from_addres,to_address,value,base')
  .option('-x', 'Cross Balance parent to sub balance')
  .option('--xa', 'Cross Balance target parent balancing group')
  .types({
    string: ['allow', 'disallow','rawtx','xa']
  })
  .action(cmd_balancing);
 
vorpal
  .command('tokenize <meter_point_id>')    
  .description("Derive digital asset (token) from Meter Point")  
  .option('--balance <address>','Balance of address')
  .option('--transfer <address>','Transfer tokens to address')
  .option('--amount <tokens>','Quantity of tokens to transfer')
   .types({
    string: ['transfer','balance']
  })
  .action(ensureToken);
  
vorpal
  .command('cutokenize <meter_point_id>')    
  .description("Derive digital utilization asset (token) from Meter Point")  
  .option('--balance <address>','Balance of address')  
  .option('--add <address>','Add Meterpoint to capacity utilization')  
  .option('--issue','Updates/Issues tokens based on last source reading')
   .types({
    string: ['add','balance']
  })
  .action(ensureCUToken);

vorpal
  .command('set <meter_point_id>')    
  .description("Creat and link a of addresses set to MP")  
  .option('--list','List addesses in set')
  .option('--add <address>','Add address to set')
  .option('--assign <address>','Assign a given SET to a different MP')
  .option('--reset','Sets a new MP Set (empty old if exists)')
   .types({
    string: ['add','assign']
  })
  .action(ensureSet);
 
vorpal
  .command('open <meter_point_id>')    
  .description("Opens Webbrowser with ledger")  
  .option('--pk', 'Inject Private Key')
  .option('-l','Open on Localhost')
  .option('-p','Print open url to console (do not open).')
  .option('-b','Open Balancing Group instead of account balance.')
  .action(function (args, callback) {
		var pks="";
		
		var node = new StromDAOBO.Node({external_id:args.meter_point_id,testMode:true,rpc:global.rpcprovider});	
		sc=smart_contract_stromkonto;
		node.roleLookup().then(function(rl) {
			rl.relations(node.wallet.address,42).then(function(tx) {
			if(typeof args.options.b == "undefined") {
					if(tx!="0x0000000000000000000000000000000000000000") {
						sc=tx;
					}
			}
					if(args.options.pk !=null) {
							pks="&pk="+node.wallet.privateKey;
					}
					if(args.options.l !=null) {
						opener("http://localhost:8000/?sc="+sc+"&account="+node.wallet.address+pks);	
					} else {
						if(args.options.p !=null) {				
							vorpal.log("https://www.stromkonto.net/?sc="+sc+"&account="+node.wallet.address+pks);
						} else 
						opener("https://www.stromkonto.net/?sc="+sc+"&account="+node.wallet.address+pks);
					}
					callback();  					
					
		});	
	});  
});

vorpal
  .command('discovergy <meter_point_id>')
  .option('-u --username <user>', 'Username for Discovergy API')    
  .option('-p --password <pass>', 'Password for Discovergy API')
  .option('-a <alias>','Meterpoint ID / Alias at Discovergy')
  .description("Links Meter Point to Discovergy Smart Meter Gateway (API)")    
  .action(function (args, callback) {		  
		var node = new StromDAOBO.Node({external_id:args.meter_point_id,testMode:true,rpc:global.rpcprovider});	
		var Discovergy = require("stromdao-bo-discovergy");		
		var oauth_name="dgy_oauth_"+Math.random();
		
		var dgy = new Discovergy("dgy_token",node);	
		
		dgy.CreateAuth(node,args.options.username,args.options.password).then(function(token) {				
			node.storage.setItemSync("dgy_token",token);
			if(typeof args.options.alias != "undefined") {
					node.storage.setItemSync("dgy_alias",args.options.alias);
				} else {
					node.storage.setItemSync("dgy_alias",args.meter_point_id);
			}
			callback();  
		});
	});    
vorpal
  .command('infrastructure <infrastructure_node> <meter_point>')
  .description("Assigns Infrastructure Node to Meter Point (Role 10)")    
  .action(function (args, callback) {		  
		var node = new StromDAOBO.Node({external_id:args.meter_point_id,testMode:true,rpc:global.rpcprovider});	
		node.roleLookup().then(function(rl) {
			rl.setRelation(10,args.infrastructure_node).then(function(x) {		
				vorpal.log(x);
				callback();
			});
		});
	}); 
		
   

vorpal
  .command('list')  
  .description("List of managed meter points")    
  .action(function (args, callback) {		  	
		var node = new StromDAOBO.Node({external_id:"stromdao-mp",testMode:true,rpc:global.rpcprovider});	  
		var managed_meters= node.storage.getItemSync("managed_meters");
		vorpal.log(JSON.parse(managed_meters));
		callback();
	}); 		
		
vorpal
  .command('httpservice')    
  .description("Start Lacy Webservice") 
  .action(function (args, callback) {	 
	
	const server = new Hapi.Server();
	server.connection({ 
		host: 'localhost', 
		port: 8000 
	});

	server.route({
		method: 'GET',
		path:'/store/', 
		handler: function (request, reply) {
			var res={};
			if(typeof request.query.meter_point_id == "undefined") {
					res.err="Missing GET parameter: meter_point_id";
					return reply(res);
			} else if(typeof request.query.reading == "undefined") {
					res.err="Missing GET parameter: reading";
					return reply(res);
			} else {
				args={};
				args.meter_point_id=request.query.meter_point_id;
				args.reading=request.query.reading;
				args.options=request.query;
				
				return cmd_store(args,function() {reply("transmitted");});
			}		 
		}
	});
	server.route({
		method: 'GET',
		path:'/retrieve/', 
		handler: function (request, reply) {
			var res={}
			if(typeof request.query.meter_point_id == "undefined") {
					res.err="Missing GET parameter: meter_point_id";
					return reply(res);
			} else {
				args={};
				args.meter_point_id=request.query.meter_point_id;				
				args.options=request.query;
				
				return cmd_retrieve(args,function(tx) {reply(JSON.stringify(tx));});
			}		 
		}
	});	
	server.route({
		method: 'GET',
		path:'/list/', 
		handler: function (request, reply) {									
				var node = new StromDAOBO.Node({external_id:"stromdao-mp",testMode:true,rpc:global.rpcprovider});	  
				var managed_meters= node.storage.getItemSync("managed_meters");				
				return reply(managed_meters);
			}		 		
	});	
	server.route({
		method: 'GET',
		path:'/account/', 
		handler: function (request, reply) {									
			if(typeof request.query.meter_point_id == "undefined") {
					res.err="Missing GET parameter: meter_point_id";
					return reply(res);
			} else {
				var node = new StromDAOBO.Node({external_id:request.query.meter_point_id,testMode:true,rpc:global.rpcprovider});	  				
				return reply(JSON.stringify(""+node.wallet.address));
			}
		}	 		
	});	
	server.register(require('inert'), (err) => {

		if (err) {
			throw err;
		}

		server.route({
			method: 'GET',
			path: '/{param*}',
			handler: {
				directory: {
					path: 'stromkonto/'
				}
			}
		});

		
	});
	server.start((err) => {

		if (err) {
			throw err;
		}
		console.log(`Server running at: ${server.info.uri}`);
		callback();
	});
	
});	

if(typeof process.env.smart_contract_stromkonto !="undefined") {	
		global.smart_contract_stromkonto=process.env.smart_contract_stromkonto;
}
if(typeof process.env.rpcprovider !="undefined") {	
		global.rpcprovider=process.env.rpcprovider;
} else {
		global.rpcprovider="https://fury.network/rpc";
}
// Ensure node has SC

var cli = new require("stromdao-cli-helper")(vorpal);


