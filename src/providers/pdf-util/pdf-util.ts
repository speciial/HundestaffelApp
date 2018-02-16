import {Injectable, ViewChild} from '@angular/core';
import {Platform} from "ionic-angular";
import {File} from "@ionic-native/file";
import {Trail} from "../../models/trail";
import {SocialSharing} from "@ionic-native/social-sharing";
import {TranslateService} from "@ngx-translate/core";

import html2canvas from "html2canvas/dist/html2canvas"
import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";
pdfMake.vfs = pdfFonts.pdfMake.vfs;

@Injectable()
export class PdfUtilProvider {
	@ViewChild('map') mapElement;
	
	pdfDirectory;
	fileName:string = "";
	translate: Array<string> = [];
	
	constructor(public platform: Platform, public fileSystem: File, public sharing: SocialSharing, public translateService: TranslateService) {
		if(this.platform.is('ios')) {
			this.pdfDirectory = this.fileSystem.documentsDirectory;
		}
		if(this.platform.is('android')){
			this.pdfDirectory = this.fileSystem.externalRootDirectory;
		}
		this.translateVariables();
	}
	
	private translateVariables(){
		let translateTerms = Array("SEARCH_OF", "DURATION", "FOR", "TYPE", "TRAIL_LAND", "TRAIL_WATER", "HISTORY_OPERATION", "HISTORY_TRAINING", "TRAINER", "WITH");
		for(let term of translateTerms){
			this.translateService.get(term).subscribe((answer) => {
				this.translate[term.toLowerCase()] = answer;
			});
		}
	}
	
	private initDirectory():Promise<string>{
		return new Promise((resolve, reject) => {
			this.fileSystem.checkDir(this.pdfDirectory, 'IonicApp').then((reason) => {
				resolve("PDF directory existing");
			}).catch((error) => {
				this.fileSystem.createDir(this.pdfDirectory, 'IonicApp', false).then((message) => {
					resolve("PDF directory created");
				}).catch((reason) => {
					reject("PDF directory not created: "+JSON.stringify(reason));
				});
			});
		});
	}
	
	private createPdf(trailSet: Trail[]):Promise<string>{
		return new Promise<string>((resolve, reject) => {
			this.fileName = 'trail_'+trailSet[0].startTime+'.pdf';
			this.fileSystem.checkFile(this.pdfDirectory+'IonicApp/', this.fileName).then((reason) => {
				resolve("File already existing");
			}).catch((reason) => {
				this.generateContent(trailSet).then((content) => {
					let pdf = pdfMake.createPdf(content);
					pdf.getBuffer((buffer) => {
						let utf8 = new Uint8Array(buffer);
						let binaryArray = utf8.buffer;
						let blob = new Blob([binaryArray], {type: 'application/pdf'});
						this.fileSystem.writeFile(this.pdfDirectory+'IonicApp/', this.fileName, blob).then((reason) => {
							resolve("File created");
						}).catch((reason) => {
							reject("File not created: "+JSON.stringify(reason));
						});
					});
				}).catch((error) => {
					reject(error);
				});
			});
		});
	}
	
	private generateContent(trailSet: Trail[]):Promise<Object>{
		return new Promise<Object>((resolve, reject) => {
			html2canvas(this.mapElement.nativeElement).then((canvas) => {
				let totalTime:number = (trailSet[trailSet.length-1].endTime)-(trailSet[0].startTime);
				let training = (trailSet[0].isTraining) ? this.translate["history_training"] : this.translate["history_operation"];
				let activity = (trailSet[0].isLandActivity) ? this.translate["trail_land"] : this.translate["trail_water"];
				let map = canvas.toDataURL("img/png");
				let dogs = [];
				trailSet.forEach((value) => {
					dogs.push(this.translate["trainer"] +' '+value.trainer+' '+this.translate["with"]+' '+value.dog+' '+
						this.translate["for"]+' '+(value.endTime-value.startTime));
				});
				
				resolve({
					content: [
						{text: this.translate["search_of"]+' '+trailSet[0].startTime, fontSize: 18, alignment: 'center'},
						{text: '\n'+this.translate["duration"]+' '+totalTime, alignment: 'center'},
						{text: '\n\n\n\n'+this.translate["type"]+ ' '+training+", "+activity},
						{stack: dogs}
					]
				});
			}).catch((error) => {
				reject(error);
			});
		});
	}
	
	sharePdf(trailSet: Trail[]):Promise<string>{
		return new Promise((resolve, reject) => {
			this.initDirectory().then((answer) => {
				this.createPdf(trailSet).then((answer) => {
					this.sharing.share(null, null, this.pdfDirectory+this.fileName, null).then((answer) => {
						resolve("Successfully shared");
					}).catch((reason) => {
						reject(reason);
					});
				}).catch((reason) => {
					reject(reason);
				});
			}).catch((error) => {
				reject(error);
			});
		});
	}
}
