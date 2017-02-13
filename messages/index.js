"use strict";
require('dotenv').config();
var builder = require("botbuilder");
var botbuilder_azure = require("botbuilder-azure");
var cognitiveServices = require('botbuilder-cognitiveservices');

var useEmulator = (process.env.NODE_ENV == 'development');

var connector = useEmulator ? new builder.ChatConnector() : new botbuilder_azure.BotServiceConnector({
    appId: process.env['MicrosoftAppId'],
    appPassword: process.env['MicrosoftAppPassword'],
    stateEndpoint: process.env['BotStateEndpoint'],
    openIdMetadata: process.env['BotOpenIdMetadata']
});

var bot = new builder.UniversalBot(connector);

// Make sure you add code to validate these fields
var luisAppId = process.env.LuisAppId;
var luisAPIKey = process.env.LuisAPIKey;
var luisAPIHostName = process.env.LuisAPIHostName || 'westus.api.cognitive.microsoft.com';

const LuisModelUrl = 'https://' + luisAPIHostName + '/luis/v2.0/apps/' + luisAppId + '?subscription-key=' + luisAPIKey;

// CREATE LOOKUP TABLES
// AWS lookup table
var awsToAzure = {
    "ec2": "[Virtual Machines](https://docs.microsoft.com/en-us/azure/virtual-machines/)",
    "elastic block store": "[Page Blobs](https://docs.microsoft.com/en-us/azure/virtual-machines/virtual-machines-linux-about-disks-vhds?toc=%2fazure%2fvirtual-machines%2flinux%2ftoc.json) or [Premium Storage](https://azure.microsoft.com/en-us/services/storage/disks/)",
    "ebs": "[Page Blobs](https://docs.microsoft.com/en-us/azure/virtual-machines/virtual-machines-linux-about-disks-vhds?toc=%2fazure%2fvirtual-machines%2flinux%2ftoc.json) or [Premium Storage](https://azure.microsoft.com/en-us/services/storage/disks/)",
    "ec2 container service": "[Container Service](https://azure.microsoft.com/en-us/services/container-service/)",
    "lambda": "[Functions](https://docs.microsoft.com/en-us/azure/azure-functions/index)",
    "elastic beanstalk": "[Web Apps](https://azure.microsoft.com/en-us/services/app-service/web/)",
    "s3": "[Blob Storage](https://azure.microsoft.com/en-us/services/app-service/web/)",
    "elastic file system": "[File Storage](https://azure.microsoft.com/en-us/services/storage/files/)",
    "efs": "[File Storage](https://azure.microsoft.com/en-us/services/storage/files/)",
    "glacier": "[Backup](https://azure.microsoft.com/en-us/services/backup/) or [Blob Storage](https://azure.microsoft.com/en-us/services/storage/blobs/)",
    "storage gateway": "[StorSimple](https://azure.microsoft.com/en-us/services/storsimple/)",
    "cloudfront": "[Content Delivery Network](https://azure.microsoft.com/en-us/services/cdn/)",
    "vpc": "[Virtual Network](https://azure.microsoft.com/en-us/services/virtual-network/)",
    "virtual private cloud": "[Virtual Network](https://azure.microsoft.com/en-us/services/virtual-network/)",
    "route 53": "[DNS](https://azure.microsoft.com/en-us/services/dns/) or [Traffic Manager](https://azure.microsoft.com/en-us/services/traffic-manager/)",
    "direct connect": "[ExpressRoute](https://azure.microsoft.com/en-us/services/expressroute/)",
    "elastic load balancing": "[Load Balancer](https://azure.microsoft.com/en-us/services/load-balancer/) or [Application Gateway](https://azure.microsoft.com/en-us/services/application-gateway/)",
    "rds": "[SQL Database](https://azure.microsoft.com/en-us/services/sql-database/)",
    "dynamodb": "[DocumentDB](https://azure.microsoft.com/en-us/services/documentdb/)",
    "redshift": "[SQL Data Warehouse](https://azure.microsoft.com/en-us/services/sql-data-warehouse/)",
    "simpledb": "[Table Storage](https://azure.microsoft.com/en-us/services/storage/tables/)",
    "elasticache": "[Azure Redis Cache](https://azure.microsoft.com/en-us/services/cache/)",
    "data pipeline": "[Data Factory](https://azure.microsoft.com/en-us/services/data-factory/)",
    "kinesis": "[Event Hubs](https://azure.microsoft.com/en-us/services/event-hubs/), [Stream Analytics](https://azure.microsoft.com/en-us/services/stream-analytics/), or [Data Lake Analytics](https://azure.microsoft.com/en-us/services/data-lake-analytics/)",
    "simple notification service": "[Notification Hubs](https://azure.microsoft.com/en-us/services/notification-hubs/)"
}

var stacks = {
    "node": "[Node Developer Center](https://azure.microsoft.com/en-us/develop/nodejs/)",
    "node . js": "[Node Developer Center](https://azure.microsoft.com/en-us/develop/nodejs/)",
    "ruby": "[Ruby Developer Center](https://azure.microsoft.com/en-us/develop/ruby/)",
    "ruby on rails": "[Ruby Developer Center](https://azure.microsoft.com/en-us/develop/ruby/)",
    "rails": "[Ruby Developer Center](https://azure.microsoft.com/en-us/develop/ruby/)",
    "python": "[Python Developer Center](https://azure.microsoft.com/en-us/develop/python/)",
    "php": "[PHP Developer Center](https://azure.microsoft.com/en-us/develop/php/)",
    "docker": "[Azure Container Service](https://azure.microsoft.com/en-us/services/container-service/)"
}

// Main dialog with LUIS
var recognizer = new builder.LuisRecognizer(LuisModelUrl);

var qna_recognizer = new cognitiveServices.QnAMakerRecognizer({
	knowledgeBaseId: process.env.KNOWLEDGEBASE_ID, 
	subscriptionKey: process.env.QNA_KEY});

var BasicQnAMakerDialog = new cognitiveServices.QnAMakerDialog({ 
	recognizers: [qna_recognizer],
	defaultMessage: 'Sorry, I did not understand your query.',
	qnaThreshold: 0.5});

var intents = new builder.IntentDialog({ recognizers: [recognizer] })

// Create VM intent
.matches('CreateVM', [
    function (session, args, next) {
        // Resolve and store any entities passed from LUIS.
        var vmType = builder.EntityRecognizer.findEntity(args.entities, 'VMType');
        var vm = session.dialogData.vm = {
          vmType: vmType ? vmType.entity : null
        };
        // Prompt for vmType
        if (!vm.vmType) {
            builder.Prompts.text(session, 'Windows or Linux?');
        } else {
            next();
        }
    },
    function (session, results, next) {
        var vm = session.dialogData.vm;
        if (results.response.toLowerCase() === 'windows' || results.response.toLowerCase() === 'linux') {
            vm.vmType = results.response;
            next();
        } else {
            session.endDialog("I'm sorry, I don't know about %s virtual machines", results.response);
        }
    },
    function (session, results) {
        var baseUrl = 'https://azure.microsoft.com/en-us/documentation/services/virtual-machines/'
        session.send("Here's how to get started with %s virtual machines: " + baseUrl + "%s/", session.dialogData.vm.vmType, session.dialogData.vm.vmType);
    }
])


// Get Azure Region Info Intent
.matches('GetRegions', [
    function (session, args, next) {
        //TODO: Add location-specific logic.
        var country = builder.EntityRecognizer.findEntity(args.entities, 'builtin.geography.city');
        if(country) {
            
        }
        var city = builder.EntityRecognizer.findEntity(args.entities, 'builtin.geography.city');
        
        session.send("Azure currently has datacenters in the following locations:\n* Virginia\n* Iowa\n* Illinois\n* Texas\n* California\n* Quebec City\n* Toronto\n* Sao Paulo State\n* Ireland\n* Netherlands\n* Frankfurt\n* Magdeburg\n* Cardiff\n* Singapore\n* Hong Kong\n* New South Wales\n*  Victoria\n* Pune\n* Mumbai\n* Chennai\n* Tokyo\n* Osaka\n* Shanghai\n* Beijing\n* Seoul.\n For more info, see [Azure Regions](https://azure.microsoft.com/en-us/regions/)");
    }
])

// Get Pricing Info Intent
.matches('GetPricingInfo', [
    function (session, args, next) {
        //TODO: Add service-specific logic.
        session.send("To get a pricing estimate for your specific scenario, check out the Azure pricing calculator: https://azure.microsoft.com/en-us/pricing/calculator/");
    }
])

// Get Started Intent
.matches('GetStarted', [
    function (session, args, next) {
        //TODO: Add service-specific logic.
        session.send("Here are some resources to get you started: [Azure Documentation](https://docs.microsoft.com/en-us/azure/), [Azure for Startups GitHub Repository](https://github.com/Azure-for-Startups/Content/blob/master/README.md), [Get Started Guide for Azure Developers](https://opbuildstorageprod.blob.core.windows.net/output-pdf-files/en-us/guides/azure-developer-guide.pdf), [Azure Tools and SDKs](https://docs.microsoft.com/en-us/azure/#pivot=sdkstools)");
    }
])

// Get Management Info Intent
.matches('GetManagementInfo', [
    function (session, args, next) {
        session.send("You can create and manage your Azure services programmatically or through the [Azure Portal](portal.azure.com). If you're a Mac user, install the [Azure CLI](https://docs.microsoft.com/en-us/azure/xplat-cli-install), and for Windows, leverage [Azure Powershell commandlets](https://docs.microsoft.com/en-us/powershell/azureps-cmdlets-docs/).  Or if you want, call the REST APIs directly: [Azure REST SDK reference](https://docs.microsoft.com/en-us/rest/api/).  And finally, [Azure Resource Manager](https://docs.microsoft.com/en-us/azure/azure-resource-manager/resource-group-overview)...use this when you want a template-based deployment for all the things.  There's a bunch of [Quickstart templates](https://github.com/Azure/azure-quickstart-templates) already on GitHub that you can start with.");
    }
])

.matches('GetStackInfo', [
    function (session, args, next) {
        var stack = builder.EntityRecognizer.findEntity(args.entities, 'LanguagesFrameworks');
        var sdkUrl = "[SDKs and Tools](https://docs.microsoft.com/en-us/azure/#pivot=sdkstools)";
        var result = "";
        if (stack) {
            var entity = stack.entity;
            if (!(entity in stacks)) {
                result = "We support lots of languages and frameworks. Take a look at our " + sdkUrl + " to get started."
            } else {
                result = "Yep, you can run " + entity + " on Azure. Check out our " + stacks[entity] + ". The " + sdkUrl + " page is pretty helpful too."
            }
        } else {
            result = "We support lots of languages and frameworks. Take a look at our " + sdkUrl + " to get started."
        }
        session.send(result);
    }
])

// Get Website Hosting Info Intent
.matches('GetWebAppHostingInfo', [
    function (session, args, next) {
        session.send("Web apps are pretty sweet, but you could also use raw VMs if you need more control.  Cloud services are a happy medium in between the two.  Check out this guide on choosing between [Web Apps, Cloud Services, and VMs](https://docs.microsoft.com/en-us/azure/app-service-web/choose-web-site-cloud-service-vm)")
    }
])

.matches('GetAWSTranslation', [
    function (session, args, next) {
        var awsService = builder.EntityRecognizer.findEntity(args.entities, 'AWSService');

        var result = "";
        if (awsService) {
            var entity = awsService.entity;
            if (!(entity in awsToAzure)) {
                result = "Check out this [Azure and AWS](https://azure.microsoft.com/en-us/overview/azure-vs-aws/mapping/) chart where you can see what services map to what.";
            } else {
                result = "Look into " + awsToAzure[entity] + ". Also, here's a guide for translating [Azure and AWS](https://azure.microsoft.com/en-us/overview/azure-vs-aws/mapping/)."
            }
        } else {
            result = " Check out this [Azure and AWS](https://azure.microsoft.com/en-us/overview/azure-vs-aws/mapping/) chart where you can see what services map to what."
        }
        session.send(result);
    }
])

// None intent
.matches('None', (session, args) => {
    //session.send('Hi! This is the None intent handler. You said: \'%s\'.', session.message.text);
    session.beginDialog('/qna').endDialog();
})

// Default intent
.onDefault((session) => {
    //session.send('Sorry, I did not understand \'%s\'.', session.message.text);
    session.beginDialog('/qna');
});

bot.dialog('/', intents);  
bot.dialog('/qna', BasicQnAMakerDialog);

if (useEmulator) {
    var restify = require('restify');
    var server = restify.createServer();
    server.listen(3978, function() {
        console.log('test bot endpont at http://localhost:3978/api/messages');
    });
    server.post('/api/messages', connector.listen());    
} else {
    module.exports = { default: connector.listen() }
}

