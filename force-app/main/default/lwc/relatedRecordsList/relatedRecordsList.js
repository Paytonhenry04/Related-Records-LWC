import { LightningElement, api, track } from 'lwc';
import getRelatedRecords from '@salesforce/apex/RelatedRecordsController.getRelatedRecords';
import { NavigationMixin } from 'lightning/navigation';

export default class RelatedRecordsList extends NavigationMixin(LightningElement) {
    @api recordId;
    @api childObjectApiName;    // e.g. 'Product2'
    @api lookupFieldApiName;    // e.g. 'Company__c'
    @api childRelationshipName; // e.g. 'Products'
    @api fieldsList;            // e.g. 'Name,ProductCode,ProductDescription'
    @api recordLimit = 2;       // Show exactly 2 cards here

    @track tableData = [];
    @track error;

    // Convenience getters for splitting fieldsList
    get fieldsArray() {
        return (this.fieldsList || '')
            .split(',')
            .map(f => f.trim())
            .filter(f => f);
    }
    get firstField() {
        return this.fieldsArray.length > 0 ? this.fieldsArray[0] : null;
    }
    get additionalFields() {
        return this.fieldsArray.length > 1 
            ? this.fieldsArray.slice(1) 
            : [];
    }

    connectedCallback() {
        this.fetchAllRelatedRecords();
    }

    get cardTitle() {
        if (this.childRelationshipName) {
            return `Related ${this.childRelationshipName.replace(/__r$/, '')}`;
        }
        return 'Related Records';
    }

    get hasRecords() {
        return Array.isArray(this.tableData) && this.tableData.length > 0;
    }

    get noRecordsNoError() {
        return !this.hasRecords && !this.error;
    }

    // Only show up to recordLimit (2) in this LWC
    get displayedData() {
        if (!this.hasRecords) {
            return [];
        }
        return this.tableData.slice(0, this.recordLimit);
    }

    // Fetch all related records (up to 200). Build each row with:
    // - title (value of firstField)
    // - url  ("/" + Id)
    // - fields: an array of { label, value } for each additional field
    fetchAllRelatedRecords() {
        if (
            !this.recordId ||
            !this.childObjectApiName ||
            !this.lookupFieldApiName ||
            !this.fieldsList
        ) {
            this.error = 'Configuration error: check childObjectApiName, lookupFieldApiName, and fieldsList.';
            this.tableData = [];
            return;
        }

        getRelatedRecords({
            parentId: this.recordId,
            childObjectApiName: this.childObjectApiName,
            lookupFieldApiName: this.lookupFieldApiName,
            fieldsString: this.fieldsList,
            limitSize: 200
        })
        .then(results => {
            const firstField = this.firstField;
            const addFields = this.additionalFields;

            // For each returned SObject, build a plain JS object:
            // {
            //    Id,
            //    title: rec[firstField],
            //    url: '/<Id>',
            //    fields: [
            //      { label: 'Product Code', value: rec['ProductCode'] },
            //      { label: 'Product Description', value: rec['ProductDescription'] },
            //      ...
            //    ]
            // }
            this.tableData = results.map(rec => {
                const row = {};
                row.Id = rec.Id;
                row.title = rec[firstField];
                row.url = '/' + rec.Id;

                // Build the fields array with label/value for each additional field
                row.fields = addFields.map(fld => {
                    return {
                        label: this.humanizeLabel(fld),
                        value: rec[fld]
                    };
                });

                return row;
            });

            this.error = undefined;
        })
        .catch(err => {
            this.error = err.body && err.body.message 
                ? err.body.message 
                : JSON.stringify(err);
            this.tableData = [];
        });
    }

    // Navigate to the “full related list” page when the header is clicked
    handleHeaderClick() {
        this[NavigationMixin.Navigate]({
            type: 'standard__recordRelationshipPage',
            attributes: {
                recordId: this.recordId,
                objectApiName: this.childObjectApiName,
                relationshipApiName: this.childRelationshipName,
                actionName: 'view'
            }
        });
    }

    // Convert an API name (e.g. “ProductCode”) into a human‐readable label (“Product Code”)
    humanizeLabel(apiName) {
        return apiName
            .replace(/__c$|__r$/, '')
            .replace(/_/g, ' ')
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            .split(' ')
            .map(w => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ');
    }
}
